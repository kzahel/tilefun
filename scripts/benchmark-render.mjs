// Rendering scorecard: fixed real-game scenes × zooms, one table per device.
// Steady camera, so it measures the cost of drawing a view, not streaming (use
// streaming:bench for motion). Isolated Vite + bundled Chromium; worlds are
// ephemeral browser-local saves. Use --headed for the display's real cadence.
//
//   npm run render:bench -- --headed
//   npm run render:bench -- --headed --scenes=crowd --zooms=0.25 --query=shadows=projected
//   npm run render:bench -- --compare=/tmp/before.json
//
// Per cell it reports frame cadence, main-thread render/update callbacks, the
// time inside backend submits (the rest of render is collection and terrain
// preparation), draw calls, and GPU time: EXT_disjoint_timer_query_webgl2 when
// the browser exposes it, and always a separate window that times render plus
// gl.finish() (a blocking, GPU-inclusive upper bound).
//
// --cdp attaches to a physical device's Chrome or the packaged desktop shell (as
// stress:bench does): it opens only its own tab on the isolated origin served at
// --port, clears that origin's storage afterwards and leaves the browser running.
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, open, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright-core";
import { createServer } from "vite";
import { openCdpTab } from "./cdp-tab.mjs";
import { allocationSummary } from "./instrumentation/allocation-summary.mjs";

const option = (key, fallback) =>
  process.argv
    .find((s) => s.startsWith(`--${key}=`))
    ?.split("=")
    .slice(1)
    .join("=") ?? fallback;

const CAR_MODELS = [
  "vehicle-v1:compact-1",
  "vehicle-v1:beetle",
  "vehicle-v1:police-car",
  "vehicle-v1:rosso-coupe",
  "vehicle-v1:rally-hatchback",
  "vehicle-v1:tow-truck",
  "vehicle-v1:dump-truck",
  "vehicle-v1:garbage-truck-orange",
];
/** Seed-2026 regional world. `city` is the generated city (apartment and shop
 * blocks, traffic, a station; the streaming bench's city arrival); `crowd` adds the
 * stress population there; `woods` is woodland beside the racetrack, with the most
 * props and wildlife in an overview. */
const SCENES = {
  city: { arrival: [300, 519], rabbits: 0, cars: 0 },
  crowd: { arrival: [300, 519], rabbits: 1000, cars: 50 },
  woods: { arrival: [-380, -364], rabbits: 0, cars: 0 },
  // The city again, sampled while driving a car along the street with the throttle
  // held: streaming, traffic and collision geometry change under the camera.
  drive: { arrival: [300, 519], rabbits: 0, cars: 0, drive: true },
};
const scenes = option("scenes", "city,crowd,woods").split(",");
for (const name of scenes) if (!SCENES[name]) throw Error(`Unknown scene ${name}`);
const zooms = option("zooms", "1,0.25,0.1").split(",").map(Number);
if (zooms.some((z) => !Number.isFinite(z) || z < 0.05 || z > 3))
  throw Error("--zooms must be numbers between 0.05 and 3");
const seconds = Number(option("seconds", "5"));
if (!Number.isFinite(seconds) || seconds < 1 || seconds > 60) throw Error("--seconds must be 1–60");
const [width, height] = option("viewport", "1280x800").split("x").map(Number);
const headed = process.argv.includes("--headed");
const output = option("output", path.join(os.tmpdir(), "tilefun-render.json"));
const compare = option("compare", "");
const endpoint = option("cdp", "");
const port = Number(option("port", "0"));
// An existing production origin (a preview server or the packaged shell's
// tilefun://app/tilefun) instead of the isolated Vite dev server.
const base = option("base", "").replace(/\/$/, "");
// Drive the browser's existing page (the packaged shell has one window, no tabs).
const attachPage = process.argv.includes("--attach-page");
if (endpoint && !port && !base) throw Error("--cdp requires a dedicated --port or --base");
if (attachPage && !(endpoint && base)) throw Error("--attach-page requires --cdp and --base");
// Extra game URL parameters, e.g. an opt-in renderer path under comparison.
const query = option("query", "");
// Sample a CPU profile of each cell's main thread and print its top self-time
// functions. Profiled timings are not the unprofiled baseline.
const profile = process.argv.includes("--profile");
// Separate diagnostic runs: sampling itself and the bench's frame records allocate.
const allocations = process.argv.includes("--allocations");
if (allocations && profile) throw Error("Use --allocations and --profile in separate runs");
// A Chrome trace of each cell (all threads and the GPU process), written beside the report.
const trace = process.argv.includes("--trace");
// Optional directory for one screenshot per cell (visual evidence for A/B runs).
const screenshots = option("screenshots", "");

if (screenshots) await mkdir(screenshots, { recursive: true });
const temp = await mkdtemp(path.join(os.tmpdir(), "tilefun-render-"));
for (const key of ["WORKSHOP_AUTH_DIR", "WORKSHOP_DATA_DIR", "ART_NOTES_DIR"])
  process.env[key] = path.join(temp, key);
let server, browser, page, testOrigin;

/** Runs in the page: one steady sample of `seconds`, then a short finish window. */
async function samplePage({ seconds, measureFinish = true }) {
  const game = document.querySelector("#game").__game;
  const surface = game.renderer.surface;
  const gl = surface?.renderer?.getContext?.();
  const timer = gl?.getExtension("EXT_disjoint_timer_query_webgl2") ?? null;
  const callbacks = game.loop.callbacks,
    render = callbacks.render,
    update = callbacks.update,
    backend = game.renderer,
    submit = backend.submit;
  const pct = (values, p) => {
    const v = [...values].sort((a, b) => a - b);
    return v.length
      ? Math.round(v[Math.min(v.length - 1, Math.floor(v.length * p))] * 100) / 100
      : null;
  };
  const stat = (values) => ({ p50: pct(values, 0.5), p95: pct(values, 0.95), max: pct(values, 1) });
  // What the main thread did inside each frame interval, for the slow ones.
  const slow = [];
  // The game's rAF callback runs before this sampler's: the work that made an
  // interval long was recorded before the previous sampler call.
  let inFrame = { updateMs: 0, updates: 0, renderMs: 0 },
    before = inFrame;
  // Texture bytes and pages uploaded per frame interval (terrain and sprite pages).
  const uploads = [],
    uploadCounts = [];
  let uploaded = game.renderer.surface?.stats?.uploadedBytes ?? 0,
    uploadCount = game.renderer.surface?.stats?.uploads ?? 0;
  const frameLoop = async (ms, each) => {
    const frames = [];
    const start = performance.now(),
      end = start + ms;
    let last = await new Promise(requestAnimationFrame);
    before = inFrame;
    inFrame = { updateMs: 0, updates: 0, renderMs: 0 };
    while (last < end) {
      const now = await new Promise(requestAnimationFrame);
      frames.push(now - last);
      const gpuStats = game.renderer.surface?.stats;
      uploads.push(((gpuStats?.uploadedBytes ?? 0) - uploaded) / 1024);
      uploadCounts.push((gpuStats?.uploads ?? 0) - uploadCount);
      uploaded = gpuStats?.uploadedBytes ?? 0;
      uploadCount = gpuStats?.uploads ?? 0;
      if (now - last > 25)
        slow.push({
          atMs: Math.round(now - start),
          // rAF timestamp on the page clock, for locating the frame in a CPU profile.
          endMs: Math.round(now * 10) / 10,
          frameMs: Math.round((now - last) * 10) / 10,
          updateMs: Math.round(before.updateMs * 10) / 10,
          updates: before.updates,
          renderMs: Math.round(before.renderMs * 10) / 10,
          // Uploads in this interval and the two before it: the GPU works behind.
          uploadKiB: Math.round(uploads.slice(-3).reduce((a, b) => a + b, 0)),
          uploadPages: uploadCounts.slice(-3).reduce((a, b) => a + b, 0),
        });
      before = inFrame;
      inFrame = { updateMs: 0, updates: 0, renderMs: 0 };
      last = now;
      each?.();
    }
    return frames;
  };
  game.performanceMetrics.reset();
  await game.transport.resetDiagnostics?.();
  const renders = [],
    updates = [],
    submits = [],
    scene = [],
    gpu = [],
    pending = [];
  let submitMs = 0,
    sceneMs = 0,
    disjoint = 0;
  const poll = () => {
    if (!timer) return;
    while (pending.length && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {
      const q = pending.shift();
      if (gl.getParameter(timer.GPU_DISJOINT_EXT)) disjoint++;
      else gpu.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
      gl.deleteQuery(q);
    }
  };
  backend.submit = function (view, pass) {
    const t = performance.now();
    submit.call(this, view, pass);
    const ms = performance.now() - t;
    submitMs += ms;
    if (pass.kind === "scene") sceneMs += ms;
  };
  callbacks.update = (dt) => {
    const t = performance.now();
    update(dt);
    updates.push(performance.now() - t);
    inFrame.updateMs += performance.now() - t;
    inFrame.updates++;
  };
  callbacks.render = (alpha, now) => {
    submitMs = sceneMs = 0;
    const q = timer && pending.length < 8 ? gl.createQuery() : null;
    if (q) gl.beginQuery(timer.TIME_ELAPSED_EXT, q);
    const t = performance.now();
    render(alpha, now);
    renders.push(performance.now() - t);
    inFrame.renderMs += performance.now() - t;
    if (q) {
      gl.endQuery(timer.TIME_ELAPSED_EXT);
      pending.push(q);
    }
    submits.push(submitMs);
    scene.push(sceneMs);
  };
  const stats = surface?.stats;
  const draws0 = stats?.drawCalls ?? 0;
  let frames;
  const finish = [];
  try {
    const driven = window.__driven?.();
    frames = await frameLoop(seconds * 1000, poll);
    // Distance within the cadence window only (not warm-up or the finish window).
    const drivenPx = driven === undefined ? undefined : window.__driven() - driven;
    const slowFrames = slow.splice(0);
    const uploadFrames = uploads.filter((kib) => kib > 0);
    const upload = {
      frames: uploadFrames.length,
      kiB: stat(uploadFrames),
      pages: uploadCounts.reduce((a, b) => a + b, 0),
      totalMiB: Math.round((uploads.reduce((a, b) => a + b, 0) / 1024) * 10) / 10,
    };
    for (const q of pending) gl.deleteQuery(q);
    const draws = stats ? (stats.drawCalls - draws0) / Math.max(1, renders.length) : null;
    // Separate window: blocking on the GPU distorts cadence, so it never shares
    // samples with the frame measurements above.
    if (measureFinish) {
      callbacks.render = (alpha, now) => {
        const t = performance.now();
        render(alpha, now);
        gl?.finish();
        finish.push(performance.now() - t);
      };
      await frameLoop(Math.min(2000, seconds * 1000));
    }
    const cadence = pct(frames, 0.5);
    const host = await game.transport.getDiagnostics?.();
    const tick = host?.authority?.timings?.["server.tick"];
    const entities = game.stateView.entities;
    return {
      frames: frames.length,
      frameMs: stat(frames),
      // Frames longer than 1.5× the median interval missed the display cadence.
      missed: frames.filter((f) => f > cadence * 1.5).length,
      slowFrames,
      upload,
      drivenPx,
      renderMs: stat(renders),
      submitMs: stat(submits),
      sceneSubmitMs: stat(scene),
      updateMs: stat(updates),
      gpuMs: gpu.length ? { ...stat(gpu), samples: gpu.length, disjoint } : null,
      renderFinishMs: finish.length ? stat(finish) : null,
      drawCallsPerFrame: draws === null ? null : Math.round(draws * 10) / 10,
      entities: entities.length,
      workerTickMs: tick
        ? { p50: Math.round(tick.p50Ms * 100) / 100, p95: Math.round(tick.p95Ms * 100) / 100 }
        : null,
      // The authority's own stage timers (rolling window), for attributing its tick.
      authorityStagesMs: Object.fromEntries(
        Object.entries(host?.authority?.timings ?? {})
          .filter(([name]) => name.startsWith("realm.") || name.startsWith("server."))
          .map(([name, t]) => [
            name,
            { p50: Math.round(t.p50Ms * 100) / 100, p95: Math.round(t.p95Ms * 100) / 100 },
          ]),
      ),
      atlasMiB: stats ? Math.round(stats.atlasBytes / 2 ** 20) : null,
    };
  } finally {
    callbacks.render = render;
    callbacks.update = update;
    backend.submit = submit;
  }
}

/** CPU profiles of the page's dedicated Workers (the authority runs in one). The
 * page session reaches them through nested target messages, on a phone as well. */
async function workerProfiler(cdp) {
  const sessions = [];
  const waiting = new Map();
  let next = 1;
  cdp.on("Target.attachedToTarget", (e) => {
    if (e.targetInfo.type === "worker") sessions.push(e.sessionId);
  });
  // Each scene navigates away and destroys the previous scene's Workers.
  cdp.on("Target.detachedFromTarget", (e) => {
    const index = sessions.indexOf(e.sessionId);
    if (index >= 0) sessions.splice(index, 1);
  });
  cdp.on("Target.receivedMessageFromTarget", (e) => {
    const message = JSON.parse(e.message);
    waiting.get(message.id)?.(message.result);
    waiting.delete(message.id);
  });
  await cdp.send("Target.setAutoAttach", {
    autoAttach: true,
    waitForDebuggerOnStart: false,
    flatten: false,
  });
  const send = (sessionId, method, params = {}) =>
    new Promise((resolve) => {
      const id = next++;
      waiting.set(id, resolve);
      // A Worker that went away mid-command answers nothing: resolve empty.
      cdp
        .send("Target.sendMessageToTarget", {
          sessionId,
          message: JSON.stringify({ id, method, params }),
        })
        .catch(() => {
          waiting.delete(id);
          resolve(undefined);
        });
    });
  return {
    async start() {
      for (const session of [...sessions]) {
        await send(session, "Profiler.enable");
        await send(session, "Profiler.setSamplingInterval", { interval: 200 });
        await send(session, "Profiler.start");
      }
    },
    async stop() {
      const profiles = [];
      for (const session of [...sessions]) {
        const stopped = await send(session, "Profiler.stop");
        if (stopped?.profile) profiles.push(stopped.profile);
      }
      return profiles;
    },
  };
}

const playerAt = (page) =>
  page.evaluate(() => {
    const p = document.querySelector("#game").__game.stateView.serverPlayerEntity;
    return { x: p.position.wx, y: p.position.wy, parent: p.parentId ?? null };
  });

/** Runs in the page: keep the player's car on the streets with the throttle held.
 * Follows road tiles straight on, turns where the road ends, and turns round when
 * stuck (backed-up traffic, a kerb). Steering-mode keys: Up throttle, Left/Right steer. */
function autopilot() {
  const g = document.querySelector("#game").__game;
  const held = new Set();
  const key = (name, down) => {
    if (held.has(name) === down) return;
    if (down) held.add(name);
    else held.delete(name);
    window.dispatchEvent(
      new KeyboardEvent(down ? "keydown" : "keyup", { key: name, code: name, bubbles: true }),
    );
  };
  const DIRS = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ];
  const road = (x, y, d, from, to) => {
    for (let i = from; i <= to; i++)
      if (
        !g.stateView.world.getRoadAt(Math.floor(x / 16) + d[0] * i, Math.floor(y / 16) + d[1] * i)
      )
        return false;
    return true;
  };
  let dir = -1,
    stuck = 0,
    path = 0,
    last;
  const timer = setInterval(() => {
    const p = g.stateView.serverPlayerEntity;
    const car = g.stateView.serverEntities.find((e) => e.id === p.parentId);
    if (!car) return;
    const { wx: x, wy: y } = car.position,
      heading = car.vehicleHeading ?? 0;
    if (last) path += Math.hypot(x - last.x, y - last.y);
    const moved = last ? Math.hypot(x - last.x, y - last.y) : 9;
    last = { x, y };
    if (dir < 0) dir = ((Math.round(heading / (Math.PI / 2)) % 4) + 4) % 4;
    stuck = moved < 0.5 ? stuck + 1 : 0;
    const open = (d) => road(x, y, DIRS[d], 2, 7);
    if (stuck > 20) {
      // Two seconds without progress: take any other open street, else turn round.
      dir = [1, 3, 2].map((turn) => (dir + turn) % 4).find(open) ?? (dir + 2) % 4;
      stuck = 0;
    } else if (!open(dir)) dir = [1, 3].map((turn) => (dir + turn) % 4).find(open) ?? dir;
    // Keep to the middle of the right-hand half of the road, like the traffic.
    const side = DIRS[(dir + 1) % 4],
      span = (sign) => {
        let n = 0;
        while (n < 10 && road(x, y, [side[0] * sign, side[1] * sign], n + 1, n + 1)) n++;
        return n;
      };
    const right = span(1),
      left = span(-1);
    const offset = ((right - left) / 2 + (right + left + 1) / 4) * 16;
    const want = dir * (Math.PI / 2) + Math.max(-0.5, Math.min(0.5, offset / 48));
    const error = Math.atan2(Math.sin(want - heading), Math.cos(want - heading));
    key("ArrowRight", error > 0.06);
    key("ArrowLeft", error < -0.06);
    key("ArrowUp", true);
  }, 100);
  window.__driven = () => Math.round(path);
  window.__autopilot = () => {
    clearInterval(timer);
    for (const name of [...held]) key(name, false);
    window.__driven = undefined;
  };
}

/** Sit in a car beside the player (spawning one the first time) and start driving. */
async function startDriving(page) {
  if ((await playerAt(page)).parent === null) {
    await page.evaluate(() => {
      const g = document.querySelector("#game").__game;
      const p = g.stateView.serverPlayerEntity.position;
      g.transport.send({ type: "set-editor-mode", enabled: true });
      g.transport.send({
        type: "edit-spawn",
        entityType: "vehicle-v1:compact-1",
        wx: p.wx + 40,
        wy: p.wy,
      });
      g.transport.send({ type: "set-editor-mode", enabled: false });
    });
    const car = () => {
      const g = document.querySelector("#game").__game;
      const p = g.stateView.serverPlayerEntity.position;
      return g.stateView.serverEntities.find(
        (e) =>
          e.type === "vehicle-v1:compact-1" &&
          Math.hypot(e.position.wx - p.wx - 40, e.position.wy - p.wy) < 24,
      )?.id;
    };
    await page.waitForFunction(car, undefined, { timeout: 20_000 });
    const entityId = await page.evaluate(car);
    await page.evaluate((entityId) => {
      const g = document.querySelector("#game").__game;
      g.transport.send({ type: "enter-vehicle", requestId: g.nextRequestId++, entityId });
    }, entityId);
    await page.waitForFunction(
      () => document.querySelector("#game").__game.stateView.serverPlayerEntity.parentId != null,
      undefined,
      { timeout: 20_000 },
    );
  }
  await page.evaluate(autopilot);
  // Up to speed before the sample begins.
  await page.waitForTimeout(1500);
}
const stopDriving = (page) => page.evaluate(() => window.__autopilot());

const idleShare = (top) => top.find((row) => row.name.startsWith("(idle)"))?.percent ?? 0;

/** Top self-time frames of a DevTools CPU profile, as shares of sampled time. */
function topSelfTime(cpuProfile, limit = 18) {
  const nodes = new Map(cpuProfile.nodes.map((n) => [n.id, n]));
  const self = new Map();
  let total = 0;
  cpuProfile.samples.forEach((id, i) => {
    const frame = nodes.get(id).callFrame;
    const name = `${frame.functionName || "(anonymous)"} ${frame.url.split("/").pop().split("?")[0]}:${frame.lineNumber + 1}`;
    const dt = cpuProfile.timeDeltas[i] ?? 0;
    self.set(name, (self.get(name) ?? 0) + dt);
    total += dt;
  });
  return [...self]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, time]) => ({ name, percent: Math.round((time / total) * 1000) / 10 }));
}

try {
  if (!base) {
    server = await createServer({
      configFile: false,
      base: "/tilefun/",
      cacheDir: path.join(temp, "vite-cache"),
      optimizeDeps: { entries: ["index.html"] },
      plugins: [react()],
      server: { host: "127.0.0.1", port, strictPort: !!port, hmr: false, watch: null },
      logLevel: "error",
    });
    await server.listen();
  }
  const origin = base || `http://127.0.0.1:${server.httpServer.address().port}/tilefun`;
  // Only the isolated Vite origin is ours to clear afterwards.
  testOrigin = base ? undefined : new URL(origin).origin;
  if (endpoint) page = await openCdpTab(endpoint, { existingPage: attachPage });
  else {
    browser = await chromium.launch({ headless: !headed, channel: "chromium" });
    page = await browser.newPage({ viewport: { width, height } });
  }
  const cdp = endpoint ? page : await page.context().newCDPSession(page);
  const workers = profile ? await workerProfiler(cdp) : undefined;
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Computed here rather than in the page, so production builds work too.
  const generation = JSON.parse(
    execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "-e",
        'import("./src/generation/GenerationDescriptor.ts").then((m) => console.log(JSON.stringify(m.createDescriptor("regional", 2026))))',
      ],
      { encoding: "utf8" },
    ),
  );
  await page.goto(`${origin}/tools.html`);
  const idle = await page.evaluate(async () => {
    const times = [];
    let previous = await new Promise(requestAnimationFrame);
    for (let i = 0; i < 90; i++) {
      const now = await new Promise(requestAnimationFrame);
      times.push(now - previous);
      previous = now;
    }
    return times.sort((a, b) => a - b)[45];
  });
  const cells = [];
  let device;
  for (const name of scenes) {
    const scene = SCENES[name];
    const arrival = { x: scene.arrival[0], y: scene.arrival[1], generation };
    await page.goto("about:blank");
    await page.goto(
      `${origin}/?nogamepad&perf&generation=${encodeURIComponent(JSON.stringify(generation))}&arrival=${encodeURIComponent(JSON.stringify(arrival))}${query ? `&${query}` : ""}`,
    );
    // Press the menu button directly: a short landscape phone viewport can
    // overlap the menu's controls.
    const newWorld = () =>
      [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "New World");
    await page.waitForFunction(newWorld, undefined, { timeout: 120_000 });
    await page.evaluate(`(${newWorld})().click()`);
    await page.waitForFunction(
      () => {
        const canvas = document.querySelector("#game");
        return canvas?.dataset.ready === "true" && !canvas.__game.mainMenu.visible;
      },
      undefined,
      { timeout: 120_000 },
    );
    let placed;
    if (scene.rabbits || scene.cars) {
      // Arrival finishes after the first ready frame; early edits are dropped.
      await page.waitForTimeout(2500);
      // The Worker channel bounds queued messages (1,024); spawn in paced batches.
      await page.evaluate(
        async ({ rabbits, cars, models }) => {
          const g = document.querySelector("#game").__game;
          const p = g.stateView.playerEntity.position;
          const spawns = [];
          for (let i = 0; i < cars; i++)
            spawns.push({
              entityType: models[i % models.length],
              wx: p.wx + ((i % 10) - 4.5) * 128,
              wy: p.wy - 160 - Math.floor(i / 10) * 96,
            });
          const side = Math.ceil(Math.sqrt(rabbits * 1.6));
          for (let i = 0; i < rabbits; i++)
            spawns.push({
              entityType: "wildlife-rabbit-v1",
              wx: p.wx + ((i % side) - side / 2) * 28 + 8,
              wy: p.wy + 48 + Math.floor(i / side) * 28,
            });
          g.transport.send({ type: "set-editor-mode", enabled: true });
          for (let i = 0; i < spawns.length; i += 200) {
            for (const spawn of spawns.slice(i, i + 200))
              g.transport.send({ type: "edit-spawn", ...spawn });
            await new Promise((resolve) => setTimeout(resolve, 250));
          }
          g.transport.send({ type: "set-editor-mode", enabled: false });
        },
        { rabbits: scene.rabbits, cars: scene.cars, models: CAR_MODELS },
      );
      // A slow authority (a phone at 1,000 rabbits) admits the batches late:
      // wait until the replicated population stops growing.
      const count = () =>
        page.evaluate(() => {
          const all = document.querySelector("#game").__game.stateView.serverEntities;
          return {
            rabbits: all.filter((e) => e.type === "wildlife-rabbit-v1").length,
            cars: all.filter((e) => e.type.startsWith("vehicle-v1:")).length,
          };
        });
      for (let i = 0; i < 20; i++) {
        await page.waitForTimeout(3000);
        const next = await count();
        const settled = placed && next.rabbits === placed.rabbits && next.cars === placed.cars;
        placed = next;
        if (settled) break;
      }
      console.log(`${name}: placed ${JSON.stringify(placed)}`);
      if (placed.rabbits < scene.rabbits * 0.7) throw Error(`${name}: crowd did not spawn`);
    }
    device ??= await page.evaluate(() => {
      const world = document.querySelector('canvas[data-renderer="gpu"]:not(#game)');
      const gl = document.querySelector("#game").__game.renderer.surface?.renderer?.getContext?.();
      const info = gl?.getExtension("WEBGL_debug_renderer_info");
      return {
        userAgent: navigator.userAgent,
        cores: navigator.hardwareConcurrency,
        viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
        canvas: world ? { width: world.width, height: world.height } : null,
        gpu: gl ? gl.getParameter(info?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER) : null,
        gpuTimer: !!gl?.getExtension("EXT_disjoint_timer_query_webgl2"),
      };
    });
    for (const zoom of zooms) {
      await page.evaluate(
        (z) => document.querySelector("#game").__game.debugPanel.setZoom(z),
        zoom,
      );
      await page.waitForFunction(
        (z) => document.querySelector("#game").__game.camera.zoom === z,
        zoom,
      );
      // Terrain preparation and caches settle; a wide overview takes a while.
      await page
        .waitForFunction(
          () => {
            const d = document.querySelector("#game").__game.renderer.getDiagnostics();
            return d.pending === 0 && d.rowsLastFrame === 0;
          },
          undefined,
          { timeout: 45_000, polling: 250 },
        )
        .catch(() => {});
      await page.waitForTimeout(1500);
      if (scene.drive) await startDriving(page);
      let traced;
      if (trace) {
        traced = new Promise((resolve) => cdp.on("Tracing.tracingComplete", resolve));
        await cdp.send("Tracing.start", {
          transferMode: "ReturnAsStream",
          categories:
            "devtools.timeline,toplevel,blink.user_timing,cc,viz,gpu,v8,benchmark,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,disabled-by-default-v8.gc",
        });
      }
      if (profile) {
        await cdp.send("Profiler.enable");
        await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
        await cdp.send("Profiler.start");
        await workers?.start();
      }
      if (allocations) {
        await cdp.send("HeapProfiler.startSampling", {
          samplingInterval: 32768,
          includeObjectsCollectedByMajorGC: true,
          includeObjectsCollectedByMinorGC: true,
        });
      }
      const cell = {
        scene: name,
        zoom,
        placed,
        ...(await page.evaluate(samplePage, { seconds, measureFinish: !allocations })),
      };
      if (allocations) {
        const { profile: heap } = await cdp.send("HeapProfiler.stopSampling");
        cell.allocations = {
          ...allocationSummary(heap),
          samplingInterval: 32768,
          scope:
            "Main thread only, cadence sample and its setup/diagnostics; GPU finish window skipped. Includes benchmark bookkeeping and collected objects. Estimated allocations, not retained heap or a GC-cause diagnosis. Sampling affects timing; compare cadence in a separate uninstrumented run.",
        };
        await writeFile(
          `${output.replace(/\.json$/, "")}.${name}-${zoom}.main.heapprofile`,
          JSON.stringify(heap),
        );
      }
      if (scene.drive) await stopDriving(page);
      // Profilers stop before the trace is downloaded: the transfer is not the scene.
      if (profile) {
        const main = (await cdp.send("Profiler.stop")).profile;
        cell.profile = topSelfTime(main);
        // Monotonic seconds at navigation start: profile timestamps use that clock.
        await cdp.send("Performance.enable");
        const { metrics } = await cdp.send("Performance.getMetrics");
        cell.navigationStartS = metrics.find((m) => m.name === "NavigationStart")?.value;
        if (output)
          await writeFile(
            `${output.replace(/\.json$/, "")}.${name}-${zoom}.main.cpuprofile`,
            JSON.stringify(main),
          );
      }
      const workerProfiles = (await workers?.stop()) ?? [];
      // The busiest Worker is the authority; idle ones only wait for messages.
      const busiest = workerProfiles
        .map((p) => ({ p, top: topSelfTime(p, 24) }))
        .sort((a, b) => idleShare(a.top) - idleShare(b.top))[0];
      if (busiest) {
        cell.workerProfile = busiest.top;
        if (output)
          await writeFile(
            `${output.replace(/\.json$/, "")}.${name}-${zoom}.worker.cpuprofile`,
            JSON.stringify(busiest.p),
          );
      }
      if (traced) {
        await cdp.send("Tracing.end");
        const { stream } = await traced;
        // Browser traces can contain unrelated browser metadata: keep them local.
        const file = await open(`${output.replace(/\.json$/, "")}.${name}-${zoom}.trace.json`, "w");
        for (;;) {
          const chunk = await cdp.send("IO.read", { handle: stream, size: 1024 * 1024 });
          await file.writeFile(
            chunk.base64Encoded ? Buffer.from(chunk.data, "base64") : chunk.data,
          );
          if (chunk.eof) break;
        }
        await file.close();
        await cdp.send("IO.close", { handle: stream });
      }
      cells.push(cell);
      for (const row of cell.profile ?? [])
        console.log(`    ${String(row.percent).padStart(5)}%  ${row.name}`);
      for (const row of cell.workerProfile ?? [])
        console.log(`    worker ${String(row.percent).padStart(5)}%  ${row.name}`);
      if (cell.allocations)
        console.log(
          `    main-thread sampled allocations ${(cell.allocations.sampledBytes / 2 ** 20).toFixed(1)} MiB (includes collected objects and sampler bookkeeping; timing is instrumented)`,
        );
      if (screenshots)
        await page.screenshot({ path: path.join(screenshots, `${name}-${zoom}.png`) });
      const g = cell.gpuMs ? `${cell.gpuMs.p50}/${cell.gpuMs.p95}` : "n/a";
      const stages = Object.entries(cell.authorityStagesMs)
        .filter(([stage]) => stage !== "server.tick")
        .map(([stage, t]) => `${stage.replace(/^(realm|server)\./, "")} ${t.p50}`);
      if (stages.length) console.log(`    authority stages p50 ms: ${stages.join(", ")}`);
      if (scene.drive)
        console.log(
          `    drove ${cell.drivenPx} px; worst frame ${cell.frameMs.max} ms; uploads ${cell.upload.totalMiB} MiB in ${cell.upload.pages} pages over ${cell.upload.frames} frames (KiB per uploading frame p50 ${cell.upload.kiB.p50}, max ${cell.upload.kiB.max})`,
        );
      for (const f of cell.slowFrames.slice(0, 14))
        console.log(
          `    slow frame at ${f.atMs} ms: ${f.frameMs} ms (update ${f.updateMs} in ${f.updates}, render ${f.renderMs}, uploads ${f.uploadPages} pages ${f.uploadKiB} KiB)`,
        );
      console.log(
        `${name.padEnd(6)} ${String(zoom).padEnd(5)} frame ${cell.frameMs.p50}/${cell.frameMs.p95} ms, missed ${cell.missed}/${cell.frames}; render ${cell.renderMs.p50}/${cell.renderMs.p95} (submit ${cell.submitMs.p50}); gpu ${g}; render+finish ${cell.renderFinishMs?.p50 ?? "n/a"}; update ${cell.updateMs.p50}; draws ${cell.drawCallsPerFrame}; tick ${cell.workerTickMs?.p50 ?? "?"}; ${cell.entities} entities`,
      );
    }
  }
  const report = {
    schemaVersion: 1,
    date: new Date().toISOString(),
    platform: endpoint ? "attached-device" : `${os.platform()} ${os.release()} ${os.arch()}`,
    cpu: endpoint ? undefined : os.cpus()[0]?.model,
    browser: endpoint ? page.browserVersion : browser.version(),
    headed: endpoint ? true : headed,
    label: option("device", endpoint ? "attached device" : os.hostname().split(".")[0]),
    build: base ? `existing origin ${base}` : "vite dev (unminified modules)",
    query,
    profiled: profile,
    allocationSampled: allocations,
    seconds,
    idleFrameMs: Math.round(idle * 100) / 100,
    device,
    cells,
    errors,
    scope:
      "Steady camera after terrain settles, except the moving drive scene; p50/p95 in ms. render = main-thread render callback; submit = time inside backend submits; gpuMs = timer query around the render callback's GL commands; renderFinishMs = render + gl.finish() in a separate window (skipped with --allocations). Rabbits wander and traffic varies, so populated scenes are not exact replays.",
  };
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Report: ${output}`);
  if (errors.length) console.log(`Page errors: ${errors.join("; ")}`);
  if (compare) {
    const before = JSON.parse(await readFile(compare, "utf8"));
    if (Boolean(before.allocationSampled) !== allocations)
      throw Error("Cannot compare allocation-sampled and ordinary timing runs");
    console.log(`\nAgainst ${compare} (${before.label}, query "${before.query}"):`);
    for (const cell of cells) {
      const old = before.cells.find((c) => c.scene === cell.scene && c.zoom === cell.zoom);
      if (!old) continue;
      const d = (key) => (cell[key] && old[key] ? `${old[key].p50} → ${cell[key].p50}` : "n/a");
      console.log(
        `${cell.scene.padEnd(6)} ${String(cell.zoom).padEnd(5)} render ${d("renderMs")} ms; gpu ${d("gpuMs")}; render+finish ${d("renderFinishMs")}; frame ${d("frameMs")}; missed ${old.missed}/${old.frames} → ${cell.missed}/${cell.frames}`,
      );
    }
  }
} finally {
  if (endpoint && page) {
    // An attached shell returns to its own menu; an owned tab is cleared and closed.
    await page.goto(attachPage ? `${base}/` : "about:blank").catch(() => {});
    if (testOrigin)
      await page
        .send("Storage.clearDataForOrigin", { origin: testOrigin, storageTypes: "all" })
        .catch(() => {});
    await page.close().catch(() => {});
  }
  await browser?.close().catch(() => {});
  await server?.close().catch(() => {});
  await rm(temp, { recursive: true, force: true });
}

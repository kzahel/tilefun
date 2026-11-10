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
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright-core";
import { createServer } from "vite";
import { openCdpTab } from "./cdp-tab.mjs";

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
/** Seed-2026 regional world. `town` is the streaming bench's city crossing (shops,
 * a few cars); `crowd` adds the stress population there; `woods` is woodland
 * beside the racetrack, with the most props and wildlife in an overview. */
const SCENES = {
  town: { arrival: [300, 519], rabbits: 0, cars: 0 },
  crowd: { arrival: [300, 519], rabbits: 1000, cars: 50 },
  woods: { arrival: [-380, -364], rabbits: 0, cars: 0 },
};
const scenes = option("scenes", "town,crowd,woods").split(",");
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
if (endpoint && !port) throw Error("--cdp requires a dedicated --port");
// Extra game URL parameters, e.g. an opt-in renderer path under comparison.
const query = option("query", "");
// Sample a CPU profile of each cell's main thread and print its top self-time
// functions. Profiled timings are not the unprofiled baseline.
const profile = process.argv.includes("--profile");
// Optional directory for one screenshot per cell (visual evidence for A/B runs).
const screenshots = option("screenshots", "");

if (screenshots) await mkdir(screenshots, { recursive: true });
const temp = await mkdtemp(path.join(os.tmpdir(), "tilefun-render-"));
for (const key of ["WORKSHOP_AUTH_DIR", "WORKSHOP_DATA_DIR", "ART_NOTES_DIR"])
  process.env[key] = path.join(temp, key);
let server, browser, page, testOrigin;

/** Runs in the page: one steady sample of `seconds`, then a short finish window. */
async function samplePage({ seconds }) {
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
  const frameLoop = async (ms, each) => {
    const frames = [];
    const end = performance.now() + ms;
    let last = await new Promise(requestAnimationFrame);
    while (last < end) {
      const now = await new Promise(requestAnimationFrame);
      frames.push(now - last);
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
  };
  callbacks.render = (alpha, now) => {
    submitMs = sceneMs = 0;
    const q = timer && pending.length < 8 ? gl.createQuery() : null;
    if (q) gl.beginQuery(timer.TIME_ELAPSED_EXT, q);
    const t = performance.now();
    render(alpha, now);
    renders.push(performance.now() - t);
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
    frames = await frameLoop(seconds * 1000, poll);
    for (const q of pending) gl.deleteQuery(q);
    const draws = stats ? (stats.drawCalls - draws0) / Math.max(1, renders.length) : null;
    // Separate window: blocking on the GPU distorts cadence, so it never shares
    // samples with the frame measurements above.
    callbacks.render = (alpha, now) => {
      const t = performance.now();
      render(alpha, now);
      gl?.finish();
      finish.push(performance.now() - t);
    };
    await frameLoop(Math.min(2000, seconds * 1000));
    const cadence = pct(frames, 0.5);
    const host = await game.transport.getDiagnostics?.();
    const tick = host?.authority?.timings?.["server.tick"];
    const entities = game.stateView.entities;
    return {
      frames: frames.length,
      frameMs: stat(frames),
      // Frames longer than 1.5× the median interval missed the display cadence.
      missed: frames.filter((f) => f > cadence * 1.5).length,
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
      atlasMiB: stats ? Math.round(stats.atlasBytes / 2 ** 20) : null,
    };
  } finally {
    callbacks.render = render;
    callbacks.update = update;
    backend.submit = submit;
  }
}

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
  const origin = `http://127.0.0.1:${server.httpServer.address().port}/tilefun`;
  testOrigin = new URL(origin).origin;
  if (endpoint) page = await openCdpTab(endpoint);
  else {
    browser = await chromium.launch({ headless: !headed, channel: "chromium" });
    page = await browser.newPage({ viewport: { width, height } });
  }
  const cdp = endpoint ? page : await page.context().newCDPSession(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${origin}/tools.html`);
  const generation = await page.evaluate(async () => {
    const { createDescriptor } = await import("/tilefun/src/generation/GenerationDescriptor.ts");
    return createDescriptor("regional", 2026);
  });
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
      if (profile) {
        await cdp.send("Profiler.enable");
        await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
        await cdp.send("Profiler.start");
      }
      const cell = {
        scene: name,
        zoom,
        placed,
        ...(await page.evaluate(samplePage, { seconds })),
      };
      if (profile) cell.profile = topSelfTime((await cdp.send("Profiler.stop")).profile);
      cells.push(cell);
      for (const row of cell.profile ?? [])
        console.log(`    ${String(row.percent).padStart(5)}%  ${row.name}`);
      if (screenshots)
        await page.screenshot({ path: path.join(screenshots, `${name}-${zoom}.png`) });
      const g = cell.gpuMs ? `${cell.gpuMs.p50}/${cell.gpuMs.p95}` : "n/a";
      console.log(
        `${name.padEnd(6)} ${String(zoom).padEnd(5)} frame ${cell.frameMs.p50}/${cell.frameMs.p95} ms, missed ${cell.missed}/${cell.frames}; render ${cell.renderMs.p50}/${cell.renderMs.p95} (submit ${cell.submitMs.p50}); gpu ${g}; render+finish ${cell.renderFinishMs?.p50}; update ${cell.updateMs.p50}; draws ${cell.drawCallsPerFrame}; tick ${cell.workerTickMs?.p50 ?? "?"}; ${cell.entities} entities`,
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
    build: "vite dev (unminified modules)",
    query,
    profiled: profile,
    seconds,
    idleFrameMs: Math.round(idle * 100) / 100,
    device,
    cells,
    errors,
    scope:
      "Steady camera after terrain settles; p50/p95 in ms. render = main-thread render callback; submit = time inside backend submits; gpuMs = timer query around the render callback's GL commands; renderFinishMs = render + gl.finish() in a separate window. Rabbits wander, so populated scenes are not exact replays.",
  };
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Report: ${output}`);
  if (errors.length) console.log(`Page errors: ${errors.join("; ")}`);
  if (compare) {
    const before = JSON.parse(await readFile(compare, "utf8"));
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
    await page.goto("about:blank").catch(() => {});
    await page
      .send("Storage.clearDataForOrigin", { origin: testOrigin, storageTypes: "all" })
      .catch(() => {});
    await page.close().catch(() => {});
  }
  await browser?.close().catch(() => {});
  await server?.close().catch(() => {});
  await rm(temp, { recursive: true, force: true });
}

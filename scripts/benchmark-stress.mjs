// Actor stress benchmark: a real game world with many wandering rabbits and
// parked cars, sampled at several zooms before and after spawning them.
// Isolated Vite + bundled Chromium (never the owner's browser/profile); worlds
// are ephemeral browser-local saves. Use --headed for the display's real cadence
// (headless rAF runs at 60 Hz).
//
//   node scripts/benchmark-stress.mjs --headed --rabbits=100 --cars=20
//
// --cdp attaches to a physical phone's Chrome (as streaming:bench does): it opens
// only its own tab on the isolated origin served at --port (reverse-forwarded to
// the phone), clears that origin's storage afterwards and leaves Chrome running.
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const option = (key, fallback) =>
  process.argv
    .find((s) => s.startsWith(`--${key}=`))
    ?.split("=")
    .slice(1)
    .join("=") ?? fallback;
const rabbits = Number(option("rabbits", "100"));
const cars = Number(option("cars", "20"));
const zooms = option("zooms", "1,0.5,0.25,0.1").split(",").map(Number);
const seconds = Number(option("seconds", "5"));
const [width, height] = option("viewport", "1728x1117").split("x").map(Number);
const arrivalTile = option("arrival", "300,519").split(",").map(Number);
const headed = process.argv.includes("--headed");
const output = option("output", path.join(os.tmpdir(), "tilefun-stress.json"));
const endpoint = option("cdp", "");
const port = Number(option("port", "0"));
if (endpoint && !port) throw Error("--cdp requires a dedicated --port");
for (const [key, value, max] of [
  ["rabbits", rabbits, 2000],
  ["cars", cars, 500],
  ["seconds", seconds, 120],
])
  if (!Number.isInteger(value) || value < 0 || value > max)
    throw Error(`--${key} must be an integer 0–${max}`);
if (zooms.some((z) => !Number.isFinite(z) || z < 0.05 || z > 3))
  throw Error("--zooms must be numbers between 0.05 and 3");
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

const temp = await mkdtemp(path.join(os.tmpdir(), "tilefun-stress-"));
for (const key of ["WORKSHOP_AUTH_DIR", "WORKSHOP_DATA_DIR", "ART_NOTES_DIR"])
  process.env[key] = path.join(temp, key);
let server, browser, page, session, testOrigin;
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
  browser = endpoint
    ? await chromium.connectOverCDP(endpoint, { noDefaults: true })
    : await chromium.launch({ headless: !headed, channel: "chromium" });
  page = endpoint
    ? await browser.contexts()[0].newPage()
    : await browser.newPage({ viewport: { width, height } });
  if (endpoint) {
    session = await browser.contexts()[0].newCDPSession(page);
    await page.bringToFront();
  }
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${origin}/tools.html`);
  const generation = await page.evaluate(async () => {
    const { createDescriptor } = await import("/tilefun/src/generation/GenerationDescriptor.ts");
    return createDescriptor("regional", 2026);
  });
  const arrival = { x: arrivalTile[0], y: arrivalTile[1], generation };
  await page.goto(
    `${origin}/?nogamepad&perf&generation=${encodeURIComponent(JSON.stringify(generation))}&arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
  );
  const newWorld = page.getByRole("button", { name: "New World", exact: true });
  let menuBlocked = false;
  try {
    await newWorld.click({ timeout: 10_000 });
  } catch {
    // A short landscape phone viewport can overlap the menu's controls; keep the
    // evidence and press the button directly so the measurement can proceed.
    menuBlocked = true;
    await page.screenshot({ path: output.replace(/\.json$/, "") + "-menu.png" });
    await newWorld.dispatchEvent("click");
  }
  await page.waitForFunction(() => {
    const canvas = document.querySelector("#game");
    return canvas.dataset.ready === "true" && !canvas.__game.mainMenu.visible;
  });

  const setZoom = async (zoom) => {
    await page.evaluate((z) => document.querySelector("#game").__game.debugPanel.setZoom(z), zoom);
    await page.waitForFunction(
      (z) => document.querySelector("#game").__game.camera.zoom === z,
      zoom,
    );
    await page.waitForTimeout(2000); // terrain preparation and caches settle
  };
  const sample = (stage, zoom) =>
    page.evaluate(
      async ({ stage, zoom, seconds }) => {
        const game = document.querySelector("#game").__game;
        game.performanceMetrics.reset();
        await game.transport.resetDiagnostics?.();
        const callbacks = game.loop.callbacks,
          render = callbacks.render,
          update = callbacks.update;
        const renders = [],
          updates = [],
          frames = [];
        callbacks.render = (alpha, now) => {
          const t = performance.now();
          render(alpha, now);
          renders.push(performance.now() - t);
        };
        callbacks.update = (dt) => {
          const t = performance.now();
          update(dt);
          updates.push(performance.now() - t);
        };
        const stats = game.renderer.surface?.stats;
        const draws0 = stats?.drawCalls ?? 0;
        try {
          const end = performance.now() + seconds * 1000;
          let last = await new Promise(requestAnimationFrame);
          while (last < end) {
            const now = await new Promise(requestAnimationFrame);
            frames.push(now - last);
            last = now;
          }
        } finally {
          callbacks.render = render;
          callbacks.update = update;
        }
        const pct = (values, p) => {
          const v = [...values].sort((a, b) => a - b);
          return v.length
            ? Math.round(v[Math.min(v.length - 1, Math.floor(v.length * p))] * 100) / 100
            : null;
        };
        const round = (v) => Math.round(v * 100) / 100;
        const cadence = pct(frames, 0.5);
        const pick = (snapshot, names) =>
          Object.fromEntries(
            names
              .filter((n) => snapshot?.[n])
              .map((n) => [
                n,
                {
                  p50: round(snapshot[n].p50Ms),
                  p95: round(snapshot[n].p95Ms),
                  max: round(snapshot[n].maxMs),
                },
              ]),
          );
        const host = await game.transport.getDiagnostics?.();
        const entities = game.stateView.entities;
        return {
          stage,
          zoom,
          frames: frames.length,
          frameMs: { p50: cadence, p95: pct(frames, 0.95), max: pct(frames, 1) },
          // Frames longer than 1.5× the median interval missed the display cadence.
          missed: frames.filter((f) => f > cadence * 1.5).length,
          renderMs: { p50: pct(renders, 0.5), p95: pct(renders, 0.95), max: pct(renders, 1) },
          updateMs: { p50: pct(updates, 0.5), p95: pct(updates, 0.95), max: pct(updates, 1) },
          drawCallsPerFrame: stats
            ? Math.round((stats.drawCalls - draws0) / Math.max(1, renders.length))
            : null,
          entities: entities.length,
          rabbits: entities.filter((e) => e.type === "wildlife-rabbit-v1").length,
          cars: entities.filter((e) => e.type.startsWith("vehicle-v1:")).length,
          client: pick(
            game.performanceMetrics.snapshot(),
            Object.keys(game.performanceMetrics.snapshot()),
          ),
          worker: pick(host?.authority?.timings, [
            "server.tick",
            "realm.ai",
            "realm.entityPhysics",
            "server.replication",
            "server.encode",
          ]),
        };
      },
      { stage, zoom, seconds },
    );

  const results = [];
  const run = async (stage) => {
    for (const zoom of zooms) {
      await setZoom(zoom);
      const r = await sample(stage, zoom);
      results.push(r);
      const w = r.worker["server.tick"];
      console.log(
        `${stage.padEnd(8)} zoom ${String(zoom).padEnd(4)} frame p50/p95 ${r.frameMs.p50}/${r.frameMs.p95} ms, missed ${r.missed}/${r.frames}; render p50/p95 ${r.renderMs.p50}/${r.renderMs.p95} ms; update p95 ${r.updateMs.p95} ms; draws ${r.drawCallsPerFrame}; worker tick p50/p95 ${w?.p50 ?? "?"}/${w?.p95 ?? "?"} ms; ${r.entities} entities (${r.rabbits} rabbits, ${r.cars} cars)`,
      );
    }
  };
  await run("baseline");
  // The Worker channel bounds queued messages (1,024); spawn in paced batches.
  const placed = await page.evaluate(
    async ({ rabbits, cars, models }) => {
      const g = document.querySelector("#game").__game;
      const p = g.stateView.playerEntity.position;
      const spawns = [];
      // Cars in a grid north of the player; rabbits in a square field south of it.
      for (let i = 0; i < cars; i++)
        spawns.push({
          entityType: models[i % models.length],
          wx: p.wx + ((i % 5) - 2) * 128,
          wy: p.wy - 160 - Math.floor(i / 5) * 96,
        });
      const side = Math.ceil(Math.sqrt(rabbits));
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
      return { at: { wx: p.wx, wy: p.wy } };
    },
    { rabbits, cars, models: CAR_MODELS },
  );
  await page.waitForTimeout(3000);
  placed.counts = await page.evaluate(() => {
    const all = document.querySelector("#game").__game.stateView.serverEntities;
    return {
      rabbits: all.filter((e) => e.type === "wildlife-rabbit-v1").length,
      cars: all.filter((e) => e.type.startsWith("vehicle-v1:")).length,
    };
  });
  console.log(`Placed (replicated): ${JSON.stringify(placed.counts)}`);
  await run("stress");
  const report = {
    date: new Date().toISOString(),
    platform: endpoint ? "physical-device" : `${os.platform()} ${os.release()} ${os.arch()}`,
    cpu: endpoint ? undefined : os.cpus()[0]?.model,
    browser: browser.version(),
    headed: endpoint ? true : headed,
    device: endpoint ? option("device", "physical device") : undefined,
    viewport: await page.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      devicePixelRatio,
    })),
    requested: { rabbits, cars },
    menuBlocked,
    placed,
    results,
    errors,
  };
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Report: ${output}`);
  if (errors.length) console.log(`Page errors: ${errors.join("; ")}`);
} finally {
  if (endpoint && page) {
    await page.goto("about:blank").catch(() => {});
    await session
      ?.send("Storage.clearDataForOrigin", { origin: testOrigin, storageTypes: "all" })
      .catch(() => {});
    await page.close().catch(() => {});
  }
  // connectOverCDP.close disconnects; it does not close the phone's Chrome.
  await browser?.close().catch(() => {});
  await server?.close().catch(() => {});
  await rm(temp, { recursive: true, force: true });
}

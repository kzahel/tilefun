// Bounded real-game traversal. Owns an isolated Vite server and bundled Chromium;
// no installed browser, persistent profile, user world, or public server needed.
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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
const headed = process.argv.includes("--headed");
const instrumentation = !process.argv.includes("--no-metrics");
const output = option("output", path.join(os.tmpdir(), "tilefun-streaming"));
const versions = option("versions", "regional-v4,regional-v10").split(",");
const cpuRate = Number(option("cpu", "1"));
const temp = await mkdtemp(path.join(os.tmpdir(), "tilefun-bench-"));
for (const key of [
  "WORKSHOP_AUTH_DIR",
  "WORKSHOP_DATA_DIR",
  "ART_NOTES_DIR",
  "INTERIOR_REVIEW_DIR",
])
  process.env[key] = path.join(temp, key);
let server, browser;
const report = {
  revision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  dirty: !!execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
  date: new Date().toISOString(),
  platform: `${os.platform()} ${os.release()} ${os.arch()}`,
  cpu: os.cpus()[0]?.model,
  headed,
  instrumentation,
  cpuRate,
  viewport: { width: 1280, height: 900 },
  fixtures: [],
};
try {
  await mkdir(output, { recursive: true });
  let origin = process.env.TILEFUN_DEV_URL;
  if (!origin) {
    server = await createServer({
      configFile: false,
      base: "/tilefun/",
      plugins: [react()],
      server: { host: "127.0.0.1", port: 0, hmr: false },
      logLevel: "error",
    });
    await server.listen();
    origin = `http://127.0.0.1:${server.httpServer.address().port}/tilefun`;
  }
  browser = await chromium.launch({ headless: !headed });
  report.browser = browser.version();
  for (const version of versions) {
    const context = await browser.newContext({ viewport: report.viewport });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpuRate });
    await page.goto(`${origin}/tools.html`);
    const arrival = await page.evaluate(async (version) => {
      const generation = { type: "regional", version, seed: 2026, preset: "temperate-v1" };
      if (version === "regional-v4") return { x: 300, y: 519, generation };
      const { CityPlacesSource } = await import(
        "/tilefun/src/generation/regional/CityPlacesPlanner.ts"
      );
      const { regionalWorld } = await import("/tilefun/src/generation/regional/WorldDescriptor.ts");
      const plan = new CityPlacesSource(regionalWorld(2026), 10).owner(0, 0);
      const lot = plan.blocks.flatMap((b) => b.lots).find((l) => l.buildingType.includes("office"));
      if (!lot) throw Error("Missing office checkpoint");
      return { x: lot.entrance.x, y: lot.entrance.y, generation };
    }, version);
    await page.goto(
      `${origin}/?nogamepad&${instrumentation ? "perf&" : ""}generation=${encodeURIComponent(JSON.stringify(arrival.generation))}&arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
    );
    await page.getByRole("button", { name: "New World", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("#game").dataset.ready === "true");
    const sample = async (name, count) => {
      const data = await page.evaluate(
        async ({ count }) => {
          const game = document.querySelector("#game").__game;
          game.performanceMetrics.reset();
          if (game.transport.resetDiagnostics) await game.transport.resetDiagnostics();
          const frames = [],
            renders = [],
            updates = [],
            visited = new Set(),
            tasks = [];
          const observer = new PerformanceObserver((list) => {
            for (const e of list.getEntries()) tasks.push(e.duration);
          });
          observer.observe({ type: "longtask" });
          const callbacks = game.loop.callbacks,
            render = callbacks.render,
            update = callbacks.update;
          const before = { ...game.stateView.playerEntity.position };
          let missingDataFrames = 0,
            incompleteCacheFrames = 0,
            maxIncomplete = 0,
            maxLoaded = 0,
            maxBuffered = 0;
          let currentGap = 0,
            longestGapFrames = 0;
          callbacks.update = (dt) => {
            const t = performance.now();
            update(dt);
            updates.push(performance.now() - t);
          };
          callbacks.render = (alpha) => {
            const t = performance.now();
            render(alpha);
            renders.push(performance.now() - t);
            const r = game.camera.getVisibleChunkRange();
            let missing = 0,
              incomplete = 0;
            for (let cy = r.minCy; cy <= r.maxCy; cy++)
              for (let cx = r.minCx; cx <= r.maxCx; cx++) {
                const p = game.camera.worldToScreen(cx * 256, cy * 256),
                  size = 256 * game.camera.scale;
                if (
                  p.sx + size <= 0 ||
                  p.sy + size <= 0 ||
                  p.sx >= game.canvas.width ||
                  p.sy >= game.canvas.height
                )
                  continue;
                visited.add(`${cx},${cy}`);
                const chunk = game.stateView.world.getChunkIfLoaded(cx, cy);
                if (!chunk) missing++;
                else if (!chunk.renderCache) incomplete++;
              }
            if (missing) missingDataFrames++;
            if (incomplete) incompleteCacheFrames++;
            currentGap = missing || incomplete ? currentGap + 1 : 0;
            longestGapFrames = Math.max(longestGapFrames, currentGap);
            maxIncomplete = Math.max(maxIncomplete, incomplete);
            maxLoaded = Math.max(maxLoaded, game.stateView.world.chunks.loadedCount);
            maxBuffered = Math.max(maxBuffered, game.remoteView?._pendingStates?.length ?? 0);
          };
          try {
            let last = await new Promise(requestAnimationFrame);
            for (let i = 0; i < count; i++) {
              const now = await new Promise(requestAnimationFrame);
              frames.push(now - last);
              last = now;
            }
          } finally {
            callbacks.render = render;
            callbacks.update = update;
            observer.disconnect();
          }
          const summary = (values) => {
            const v = [...values].sort((a, b) => a - b);
            const q = (p) => v[Math.min(v.length - 1, Math.floor(v.length * p))] ?? 0;
            return { count: v.length, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: q(1) };
          };
          const after = game.stateView.playerEntity.position;
          return {
            frames: summary(frames),
            renderMs: summary(renders),
            updateMs: summary(updates),
            longTasksMs: summary(tasks),
            framesOver25Ms: frames.filter((v) => v > 25).length,
            framesOver50Ms: frames.filter((v) => v > 50).length,
            missingDataFrames,
            incompleteCacheFrames,
            maxIncomplete,
            longestGapFrames,
            maxLoaded,
            maxBuffered,
            visitedChunks: visited.size,
            displacement: { x: after.wx - before.wx, y: after.wy - before.wy },
            entities: game.stateView.entities.length,
            props: game.stateView.props.length,
            mainThread: game.performanceMetrics.snapshot(),
            host: game.transport.getDiagnostics ? await game.transport.getDiagnostics() : null,
            heapBytes: performance.memory?.usedJSHeapSize ?? null,
          };
        },
        { count },
      );
      const result = { name, ...data };
      console.log(JSON.stringify({ version, ...result }));
      return result;
    };
    const samples = [];
    samples.push(await sample("cold", 120));
    await page.screenshot({ path: path.join(output, `${version}-settled.png`) });
    samples.push(await sample("standing", 120));
    await page.keyboard.down("ArrowLeft");
    samples.push(await sample("walk", 180));
    await page.keyboard.down("Shift");
    const sprint = await sample("sprint", 300);
    samples.push(sprint);
    await page.keyboard.up("ArrowLeft");
    await page.keyboard.down("ArrowRight");
    samples.push(await sample("reverse", 300));
    await page.keyboard.up("ArrowRight");
    await page.keyboard.up("Shift");
    await page.evaluate(() => {
      document.querySelector("#game").__game.camera.zoom *= 0.6;
    });
    samples.push(await sample("zoom-out", 180));
    await page.screenshot({ path: path.join(output, `${version}-zoom.png`) });
    if (Math.abs(sprint.displacement.x) < 256 || sprint.visitedChunks < 6)
      throw Error(`${version}: traversal failed to cross terrain (${sprint.displacement.x}px)`);
    if (errors.length) throw Error(errors.join("\n"));
    report.fixtures.push({ version, arrival, samples, errors });
    await context.close();
  }
  await writeFile(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Report: ${path.join(output, "report.json")}`);
} finally {
  await browser?.close();
  await server?.close();
  await rm(temp, { recursive: true, force: true });
}

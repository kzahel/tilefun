// Bounded real-game traversal. Defaults to isolated Vite + bundled Chromium.
// --cdp attaches to a physical phone's Chrome, using only a new test tab/origin.
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, open, rm, writeFile } from "node:fs/promises";
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
const renderer = option("renderer", "canvas");
if (!["canvas", "gpu"].includes(renderer)) throw Error("--renderer must be canvas or gpu");
const meshes = process.argv.includes("--meshes");
const headed = process.argv.includes("--headed");
const instrumentation = !process.argv.includes("--no-metrics");
const output = option("output", path.join(os.tmpdir(), "tilefun-streaming"));
const versions = option("versions", "current").split(",");
const cpuRate = Number(option("cpu", "1"));
const endpoint = option("cdp", "");
const port = Number(option("port", "0"));
const touch = process.argv.includes("--touch");
const traceStage = option("trace-stage", "");
const traceFrames = Number(option("trace-frames", "600"));
const frameTimelineEnabled = process.argv.includes("--frame-timeline");
const zoomSettled = process.argv.includes("--zoom-settled");
const pauseZoomPreparation = process.argv.includes("--pause-zoom-preparation");
const zoomRowBudget = Number(option("zoom-row-budget", "0"));
if (!Number.isInteger(zoomRowBudget) || zoomRowBudget < 0 || zoomRowBudget > 128)
  throw Error("--zoom-row-budget must be between 1 and 128, or 0 for the default");
if (!Number.isInteger(traceFrames) || traceFrames < 1 || traceFrames > 3600)
  throw Error("--trace-frames must be between 1 and 3600");
if (endpoint && (process.env.TILEFUN_DEV_URL || !port || cpuRate !== 1))
  throw Error(
    "Physical-device CDP requires a dedicated --port, no existing server and no CPU emulation",
  );
const temp = await mkdtemp(path.join(os.tmpdir(), "tilefun-bench-"));
for (const key of [
  "WORKSHOP_AUTH_DIR",
  "WORKSHOP_DATA_DIR",
  "ART_NOTES_DIR",
  "INTERIOR_REVIEW_DIR",
])
  process.env[key] = path.join(temp, key);
let server, browser;
let devicePage, deviceSession, testOrigin;
let activeTraceSession;
const report = {
  revision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  dirty: !!execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
  date: new Date().toISOString(),
  platform: endpoint ? "physical-device" : `${os.platform()} ${os.release()} ${os.arch()}`,
  cpu: endpoint ? undefined : os.cpus()[0]?.model,
  device: endpoint ? option("device", "unspecified physical device") : undefined,
  headed: endpoint ? true : headed,
  input: touch ? "touch joystick and sprint button" : "keyboard",
  ...(traceStage ? { traceStage, traceFrames } : {}),
  ...(pauseZoomPreparation ? { diagnosticControl: "pause terrain preparation after zoom" } : {}),
  ...(zoomRowBudget ? { diagnosticZoomRowBudget: zoomRowBudget } : {}),
  instrumentation,
  renderer,
  meshes,
  cpuRate,
  viewport: endpoint ? null : { width: 1280, height: 900 },
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
      server: { host: "127.0.0.1", port, strictPort: true, hmr: false },
      logLevel: "error",
    });
    await server.listen();
    origin = `http://127.0.0.1:${server.httpServer.address().port}/tilefun`;
  }
  testOrigin = new URL(origin).origin;
  browser = endpoint
    ? await chromium.connectOverCDP(endpoint, { noDefaults: true })
    : await chromium.launch({ headless: !headed, channel: "chromium" });
  report.browser = browser.version();
  for (const version of versions) {
    const context = endpoint
      ? browser.contexts()[0]
      : await browser.newContext({ viewport: report.viewport, hasTouch: touch });
    const page = await context.newPage();
    if (endpoint) devicePage = page;
    await page.bringToFront();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const cdp = await context.newCDPSession(page);
    if (endpoint) deviceSession = cdp;
    else await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpuRate });
    await page.goto(`${origin}/tools.html`);
    const arrival = await page.evaluate(async (version) => {
      const { createDescriptor } = await import("/tilefun/src/generation/GenerationDescriptor.ts");
      const generation = createDescriptor("regional", 2026);
      if (version !== "current" && version !== generation.version)
        throw Error("Retired generator: use --versions=current");
      return { x: 300, y: 519, generation };
    }, version);
    await page.goto(
      `${origin}/?nogamepad&renderer=${renderer}&${meshes ? "meshes&" : ""}${instrumentation ? "perf&" : ""}generation=${encodeURIComponent(JSON.stringify(arrival.generation))}&arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
    );
    await page.getByRole("button", { name: "New World", exact: true }).click();
    await page.waitForFunction((arrival) => {
      const canvas = document.querySelector("#game"),
        game = canvas.__game;
      const p = game.stateView.playerEntity.position;
      return (
        canvas.dataset.ready === "true" &&
        canvas.dataset.generation === JSON.stringify(arrival.generation) &&
        !game.mainMenu.visible &&
        Math.hypot(p.wx / 16 - arrival.x, p.wy / 16 - arrival.y) <= 46
      );
    }, arrival);
    const actualRenderer = await page.locator("#game").getAttribute("data-renderer");
    if (renderer === "gpu" && actualRenderer !== "gpu")
      throw Error(`GPU benchmark fell back to ${actualRenderer}`);
    const display = await page.evaluate(() => ({
      viewport: { width: innerWidth, height: innerHeight },
      screen: { width: screen.width, height: screen.height },
      devicePixelRatio,
      maxTouchPoints: navigator.maxTouchPoints,
      userAgent: navigator.userAgent,
      canvas: {
        width: document.querySelector("#game").width,
        height: document.querySelector("#game").height,
      },
    }));
    if (endpoint) report.viewport = display.viewport;
    const move = async (direction, sprint = false, initial = false) => {
      if (!touch) return;
      const points = await page.evaluate(
        ({ direction, sprint, initial }) => {
          const g = document.querySelector("#game").__game;
          const b = g.canvas.getBoundingClientRect();
          const base = { x: Math.min(140, b.width * 0.35), y: b.height * 0.6 };
          const points = [
            { id: 0, x: b.x + base.x + (initial ? 0 : direction * 50), y: b.y + base.y },
          ];
          if (sprint) {
            const p = g.touchButtons.getPositions()[2];
            points.push({
              id: 1,
              x: b.x + (p.x * b.width) / g.canvas.width,
              y: b.y + (p.y * b.height) / g.canvas.height,
            });
          }
          return points;
        },
        { direction, sprint, initial },
      );
      await cdp.send("Input.dispatchTouchEvent", {
        type: initial || sprint ? "touchStart" : "touchMove",
        touchPoints: points,
      });
      if (initial) await move(direction);
    };
    const sample = async (name, count) => {
      const tracing = name === traceStage;
      let traceComplete;
      if (tracing) {
        traceComplete = new Promise((resolve) => cdp.once("Tracing.tracingComplete", resolve));
        await cdp.send("Tracing.start", {
          transferMode: "ReturnAsStream",
          categories:
            "devtools.timeline,toplevel,blink.user_timing,cc,viz,gpu,v8,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,disabled-by-default-v8.gc",
        });
        activeTraceSession = cdp;
        count = traceFrames;
      }
      const data = await page.evaluate(
        async ({ count, tracing, timeline }) => {
          const game = document.querySelector("#game").__game;
          game.performanceMetrics.reset();
          if (game.transport.resetDiagnostics) await game.transport.resetDiagnostics();
          const frames = [],
            renders = [],
            updates = [],
            visited = new Set(),
            tasks = [];
          const frameTimeline = [];
          const observer = new PerformanceObserver((list) => {
            for (const e of list.getEntries()) tasks.push(e.duration);
          });
          observer.observe({ type: "longtask" });
          const callbacks = game.loop.callbacks,
            render = callbacks.render,
            update = callbacks.update;
          const before = { ...game.stateView.playerEntity.position };
          const sent = new Map(),
            ackTimes = [],
            corrections = [];
          const send = game.transport.send;
          let lastSent = game.stateView.lastProcessedInputSeq,
            lastAck = lastSent,
            maxAckGap = 0;
          game.transport.send = (message) => {
            if (message.type === "player-input") {
              sent.set(message.seq, performance.now());
              lastSent = message.seq;
              if (sent.size > 1024) sent.delete(sent.keys().next().value);
            }
            return send.call(game.transport, message);
          };
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
            if (tracing)
              performance.measure("tilefun.render", { start: t, end: performance.now() });
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
                else if (!game.renderer.hasTerrain(chunk)) incomplete++;
              }
            if (missing) missingDataFrames++;
            if (incomplete) incompleteCacheFrames++;
            currentGap = missing || incomplete ? currentGap + 1 : 0;
            longestGapFrames = Math.max(longestGapFrames, currentGap);
            maxIncomplete = Math.max(maxIncomplete, incomplete);
            maxLoaded = Math.max(maxLoaded, game.stateView.world.chunks.loadedCount);
            maxBuffered = Math.max(maxBuffered, game.remoteView?.pendingMessageCount ?? 0);
            const ack = game.stateView.lastProcessedInputSeq;
            maxAckGap = Math.max(maxAckGap, lastSent - ack);
            if (ack !== lastAck) {
              if (sent.has(ack)) ackTimes.push(performance.now() - sent.get(ack));
              for (const seq of sent.keys()) if (seq <= ack) sent.delete(seq);
              const diagnostic = game.stateView.predictionDiagnostics;
              if (diagnostic) corrections.push(diagnostic.resimPosErr);
              lastAck = ack;
            }
          };
          try {
            if (tracing) performance.mark("tilefun.sample.start");
            let last = await new Promise(requestAnimationFrame);
            for (let i = 0; i < count; i++) {
              const now = await new Promise(requestAnimationFrame);
              frames.push(now - last);
              if (timeline) {
                frameTimeline.push({
                  index: i,
                  rafMs: now,
                  callbackMs: performance.now(),
                  intervalMs: now - last,
                });
              }
              if (tracing) performance.measure("tilefun.frame", { start: last, end: now });
              last = now;
            }
            if (tracing) performance.mark("tilefun.sample.end");
          } finally {
            callbacks.render = render;
            callbacks.update = update;
            game.transport.send = send;
            observer.disconnect();
          }
          const summary = (values) => {
            const v = [...values].sort((a, b) => a - b);
            const q = (p) => v[Math.min(v.length - 1, Math.floor(v.length * p))] ?? 0;
            return { count: v.length, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: q(1) };
          };
          const after = game.stateView.playerEntity.position;
          return {
            ...(timeline ? { frameTimeline } : {}),
            renderedFrames: renders.length,
            inputAckMs: summary(ackTimes),
            maxAckGap,
            predictionResimulationErrorPx: summary(corrections),
            cache: game.renderer.getDiagnostics?.() ?? null,
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
        { count, tracing, timeline: tracing || frameTimelineEnabled },
      );
      if (tracing) {
        await cdp.send("Tracing.end");
        activeTraceSession = undefined;
        const { stream } = await traceComplete;
        // Browser traces can contain unrelated browser metadata. Keep raw files local.
        const file = await open(path.join(output, `${version}-${name}-trace.json`), "w", 0o600);
        try {
          for (;;) {
            const chunk = await cdp.send("IO.read", { handle: stream, size: 1024 * 1024 });
            await file.writeFile(
              chunk.base64Encoded ? Buffer.from(chunk.data, "base64") : chunk.data,
            );
            if (chunk.eof) break;
          }
        } finally {
          await file.close();
          await cdp.send("IO.close", { handle: stream });
        }
      }
      const result = { name, ...data };
      console.log(JSON.stringify({ version, ...result }));
      return result;
    };
    const samples = [];
    samples.push(await sample("cold", 120));
    await page.screenshot({ path: path.join(output, `${version}-settled.png`) });
    samples.push(await sample("standing", 120));
    if (touch) await move(-1, false, true);
    else await page.keyboard.down("ArrowLeft");
    samples.push(await sample("walk", 180));
    if (touch) await move(-1, true);
    else await page.keyboard.down("Shift");
    const sprint = await sample("sprint", 300);
    samples.push(sprint);
    if (touch) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await move(1, false, true);
      await move(1, true);
    } else {
      await page.keyboard.up("ArrowLeft");
      await page.keyboard.down("ArrowRight");
    }
    samples.push(await sample("reverse", 300));
    if (touch) await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    else {
      await page.keyboard.up("ArrowRight");
      await page.keyboard.up("Shift");
    }
    await page.evaluate(
      ({ pausePreparation, rowBudget }) => {
        const game = document.querySelector("#game").__game;
        if (pausePreparation) game.renderer.prepareTerrain = () => {};
        else if (rowBudget) {
          const prepare = game.renderer.prepareTerrain.bind(game.renderer);
          game.renderer.prepareTerrain = (camera, world, visible) =>
            prepare(camera, world, visible, { timeBudgetMs: 2, rowBudget });
        }
        game.debugPanel.setZoom(0.5);
      },
      { pausePreparation: pauseZoomPreparation, rowBudget: zoomRowBudget },
    );
    samples.push(await sample("zoom-out", 180));
    if (zoomSettled) samples.push(await sample("zoom-settled", 180));
    await page.screenshot({ path: path.join(output, `${version}-zoom.png`) });
    // Keep measurements available even when a coverage assertion fails.
    report.fixtures.push({ version, arrival, display, samples, errors });
    await writeFile(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    if (Math.abs(sprint.displacement.x) < 256 || sprint.visitedChunks < 6)
      throw Error(`${version}: traversal failed to cross terrain (${sprint.displacement.x}px)`);
    if (errors.length) throw Error(errors.join("\n"));
    if (process.argv.includes("--assert-ready")) {
      for (const s of samples.filter((s) => ["walk", "sprint", "reverse"].includes(s.name)))
        if (s.missingDataFrames || s.incompleteCacheFrames)
          throw Error(`${version}/${s.name}: visible terrain was not ready`);
    }
    if (endpoint) {
      await page.goto("about:blank");
      await cdp.send("Storage.clearDataForOrigin", { origin: testOrigin, storageTypes: "all" });
      await page.close();
      devicePage = deviceSession = undefined;
    } else await context.close();
  }
  await writeFile(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Report: ${path.join(output, "report.json")}`);
} finally {
  await activeTraceSession?.send("Tracing.end").catch(() => {});
  if (devicePage) {
    await devicePage.goto("about:blank").catch(() => {});
    await deviceSession
      ?.send("Storage.clearDataForOrigin", { origin: testOrigin, storageTypes: "all" })
      .catch(() => {});
    await devicePage.close().catch(() => {});
  }
  // connectOverCDP.close disconnects; it does not close the phone's Chrome.
  await browser?.close();
  await server?.close();
  await rm(temp, { recursive: true, force: true });
}

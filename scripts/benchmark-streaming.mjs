// Bounded real-game traversal. Defaults to isolated Vite + bundled Chromium.
// --cdp attaches to a physical phone's Chrome, using only a new test tab/origin.
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, open, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright-core";
import { createServer } from "vite";
import { readAndroidThermals, waitForAndroidCool } from "./android-thermal-gate.mjs";
import { disableImageDimensionCache } from "./streaming-dimension-control.mjs";
import { installStreamingProfile, summarizeCpuProfile } from "./streaming-profile.mjs";

const option = (key, fallback) =>
  process.argv
    .find((s) => s.startsWith(`--${key}=`))
    ?.split("=")
    .slice(1)
    .join("=") ?? fallback;
const renderer = option("renderer", "canvas");
if (!["canvas", "gpu"].includes(renderer)) throw Error("--renderer must be canvas or gpu");
const terrainPacing = option("terrain-pacing", "throughput");
if (!["throughput", "responsive"].includes(terrainPacing))
  throw Error("--terrain-pacing must be throughput or responsive");
const zoomMotion = process.argv.includes("--zoom-motion");
const motionZooms = option("zooms", "1,0.5,0.25,0.1,2").split(",").map(Number);
if (
  motionZooms.some((z) => !Number.isFinite(z) || z < 0.05 || z > 3) ||
  new Set(motionZooms).size !== motionZooms.length
)
  throw Error("--zooms requires unique numbers between 0.05 and 3");
const movementSeconds = Number(option("movement-seconds", "8"));
const settleSeconds = Number(option("settle-seconds", "30"));
const warmSeconds = Number(option("warm-seconds", "2"));
for (const [key, value] of Object.entries({ movementSeconds, settleSeconds, warmSeconds }))
  if (!Number.isFinite(value) || value < 1 || value > 300)
    throw Error(`${key} must be between 1 and 300`);
const zoomSweep = process.argv.includes("--zoom-sweep");
const catchupFrames = Number(option("catchup-frames", "7200"));
if (!Number.isInteger(catchupFrames) || catchupFrames < 60 || catchupFrames > 14400)
  throw Error("--catchup-frames must be between 60 and 14400");
const assertBounded = process.argv.includes("--assert-bounded");
if (assertBounded && (terrainPacing !== "responsive" || !(zoomSweep || zoomMotion)))
  throw Error(
    "--assert-bounded requires --terrain-pacing=responsive and --zoom-sweep or --zoom-motion",
  );
const uncachedImageSizes = process.argv.includes("--uncached-image-sizes");
if (uncachedImageSizes && (renderer !== "gpu" || process.env.TILEFUN_DEV_URL))
  throw Error("--uncached-image-sizes requires GPU and the isolated benchmark server");
const meshes = process.argv.includes("--meshes");
const noclip = process.argv.includes("--noclip");
const headed = process.argv.includes("--headed");
const instrumentation = !process.argv.includes("--no-metrics");
const output = option("output", path.join(os.tmpdir(), "tilefun-streaming"));
const versions = option("versions", "current").split(",");
const cpuRate = Number(option("cpu", "1"));
const endpoint = option("cdp", "");
const port = Number(option("port", "0"));
const touch = process.argv.includes("--touch");
const androidCli = option("android-device-cli", "");
const maxBatteryC = Number(option("max-battery-c", "29"));
const cooldownSeconds = Number(option("cooldown-timeout-seconds", "600"));
if (
  androidCli &&
  (!endpoint ||
    !Number.isFinite(maxBatteryC) ||
    maxBatteryC < 15 ||
    maxBatteryC > 40 ||
    !Number.isFinite(cooldownSeconds) ||
    cooldownSeconds < 1 ||
    cooldownSeconds > 1800)
)
  throw Error(
    "Thermal gate requires physical CDP, max-battery-c 15–40 and cooldown-timeout-seconds 1–1800",
  );
const sprintFrames = Number(option("sprint-frames", "300"));
if (!Number.isInteger(sprintFrames) || sprintFrames < 1 || sprintFrames > 7200)
  throw Error("--sprint-frames must be between 1 and 7200");
const traceStage = option("trace-stage", "");
const profileStage = option("profile-stage", "");
const traceFrames = Number(option("trace-frames", "600"));
const frameTimelineEnabled = process.argv.includes("--frame-timeline");
const zoomSettled = process.argv.includes("--zoom-settled");
const pauseZoomPreparation = process.argv.includes("--pause-zoom-preparation");
const terrainRowBudget = Number(option("terrain-row-budget", "0"));
if (!Number.isInteger(terrainRowBudget) || terrainRowBudget < 0 || terrainRowBudget > 128)
  throw Error("--terrain-row-budget must be between 1 and 128, or 0 for the default");
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
const failures = [];
const cooldownAbort = new AbortController();
const interrupt = () => {
  cooldownAbort.abort();
  void (async () => {
    await devicePage?.close().catch(() => {});
    await browser?.close().catch(() => {});
  })();
};
process.once("SIGINT", interrupt);
process.once("SIGTERM", interrupt);
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
  ...(terrainRowBudget ? { diagnosticTerrainRowBudget: terrainRowBudget } : {}),
  ...(zoomRowBudget ? { diagnosticZoomRowBudget: zoomRowBudget } : {}),
  instrumentation,
  ...(uncachedImageSizes ? { diagnosticUncachedImageSizes: true } : {}),
  terrainPacing,
  zoomSweep,
  zoomMotion,
  ...(zoomMotion ? { motionZooms, movementSeconds, settleSeconds, warmSeconds } : {}),
  catchupFrames,
  sprintFrames,
  noclip,
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
      plugins: [
        react(),
        ...(uncachedImageSizes
          ? [
              {
                name: "streaming-dimension-control",
                enforce: "pre",
                transform(code, id) {
                  if (id.endsWith("/src/rendering/GpuRasterSurface.ts"))
                    return disableImageDimensionCache(code);
                },
              },
            ]
          : []),
      ],
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
  const cases = versions.flatMap((version) =>
    (zoomMotion ? motionZooms : [null]).map((zoom) => ({ version, zoom })),
  );
  for (const { version, zoom } of cases) {
    const fixtureName = zoom === null ? version : `${version}-zoom-${zoom}`;
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
    // An idle page measures the display cadence before a heavy view can lower it.
    const displayCadenceMs = zoomMotion
      ? await page.evaluate(async () => {
          const times = [];
          let last = await new Promise(requestAnimationFrame);
          for (let i = 0; i < 90; i++) {
            const now = await new Promise(requestAnimationFrame);
            if (i >= 30) times.push(now - last);
            last = now;
          }
          times.sort((a, b) => a - b);
          return times[Math.floor(times.length / 2)];
        })
      : null;
    const thermalsBefore = androidCli
      ? await waitForAndroidCool(androidCli, maxBatteryC, cooldownSeconds, cooldownAbort.signal)
      : undefined;
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
    await page.evaluate(
      (value) => document.querySelector("#game").__game.debugPanel.setTerrainPacing(value),
      terrainPacing,
    );
    if (noclip)
      await page.evaluate(() => document.querySelector("#game").__game.debugPanel.setNoclip(true));
    if (terrainRowBudget)
      await page.evaluate((rowBudget) => {
        const renderer = document.querySelector("#game").__game.renderer;
        const prepare = renderer.prepareTerrain.bind(renderer);
        renderer.prepareTerrain = (camera, world, visible) =>
          prepare(camera, world, visible, { timeBudgetMs: 2, rowBudget });
      }, terrainRowBudget);
    if (zoomMotion) {
      await page.evaluate(
        (value) => document.querySelector("#game").__game.debugPanel.setZoom(value),
        zoom,
      );
      await page.waitForFunction(
        (value) => document.querySelector("#game").__game.camera.zoom === value,
        zoom,
      );
    }
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
    const sample = async (name, count, untilSettled = false, durationMs = 0) => {
      const tracing = name === traceStage;
      const profiling = name === profileStage;
      if (profiling) {
        await page.evaluate(installStreamingProfile);
        await cdp.send("Profiler.enable");
        await cdp.send("Profiler.start");
      }
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
        async ({ count, tracing, timeline, untilSettled, durationMs, displayCadenceMs }) => {
          const game = document.querySelector("#game").__game;
          game.performanceMetrics.reset();
          if (game.transport.resetDiagnostics) await game.transport.resetDiagnostics();
          const frames = [],
            renders = [],
            updates = [],
            visited = new Set(),
            tasks = [];
          const frameTimeline = [];
          const renderTimeline = [];
          const phases = {
            beginMs: 0,
            prepareMs: 0,
            submitMs: 0,
            pageMs: 0,
            flushMs: 0,
            meshMs: 0,
          };
          const restores = [];
          const instrument = (owner, method, key) => {
            if (!tracing || !owner || typeof owner[method] !== "function") return;
            const original = owner[method];
            owner[method] = function (...args) {
              const start = performance.now();
              try {
                return original.apply(this, args);
              } finally {
                phases[key] += performance.now() - start;
              }
            };
            restores.push(() => {
              owner[method] = original;
            });
          };
          instrument(game.renderHost, "beginFrame", "beginMs");
          instrument(game.renderer, "prepareTerrain", "prepareMs");
          instrument(game.renderer, "submit", "submitMs");
          instrument(game.renderer.surface, "page", "pageMs");
          instrument(game.renderer.surface, "flush", "flushMs");
          instrument(game.renderer.meshes, "draw", "meshMs");
          const gpuStats = game.renderer.surface?.stats;
          let previousUpload = gpuStats?.uploadedBytes ?? 0;
          let previousVertex = gpuStats?.vertexUploadedBytes ?? 0;
          let previousDraws = gpuStats?.drawCalls ?? 0;
          const initialDraws = previousDraws;
          const initialUpload = previousUpload;
          const initialVertex = previousVertex;
          let maxTerrainRows = 0,
            totalTerrainRows = 0,
            peakPending = 0;
          let finalMissing = 0,
            finalIncomplete = 0,
            finalStale = 0;
          let firstReadyFrame = null,
            settledFrames = 0,
            settled = false;
          let staleCacheFrames = 0;
          let sampleStartMs = 0;
          let travelledPx = 0,
            stationaryMs = 0,
            maxStationaryMs = 0;
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
          callbacks.render = (alpha, now) => {
            const t = performance.now();
            if (tracing) for (const key of Object.keys(phases)) phases[key] = 0;
            render(alpha, now);
            const end = performance.now();
            renders.push(end - t);
            const terrain = game.renderer.getDiagnostics();
            maxTerrainRows = Math.max(maxTerrainRows, terrain.rowsLastFrame);
            totalTerrainRows += terrain.rowsLastFrame;
            peakPending = Math.max(peakPending, terrain.pending);
            if (tracing) {
              const diagnostics = game.renderer.getDiagnostics?.();
              renderTimeline.push({
                startMs: t,
                endMs: end,
                ...phases,
                terrainRows: diagnostics?.rowsLastFrame ?? 0,
                textureUploadedBytes: (gpuStats?.uploadedBytes ?? 0) - previousUpload,
                vertexUploadedBytes: (gpuStats?.vertexUploadedBytes ?? 0) - previousVertex,
                drawCalls: (gpuStats?.drawCalls ?? 0) - previousDraws,
              });
              previousUpload = gpuStats?.uploadedBytes ?? 0;
              previousVertex = gpuStats?.vertexUploadedBytes ?? 0;
              previousDraws = gpuStats?.drawCalls ?? 0;
            }
            if (tracing) performance.measure("tilefun.render", { start: t, end });
            const r = game.camera.getVisibleChunkRange();
            let missing = 0,
              incomplete = 0,
              stale = 0;
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
                else if (!game.renderer.isTerrainReady(chunk)) stale++;
              }
            finalMissing = missing;
            finalIncomplete = incomplete;
            finalStale = stale;
            if (stale) staleCacheFrames++;
            if (!missing && !incomplete && !stale && firstReadyFrame === null)
              firstReadyFrame = renders.length;
            settledFrames =
              !missing && !incomplete && !stale && !terrain.pending && !terrain.rowsLastFrame
                ? settledFrames + 1
                : 0;
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
            sampleStartMs = performance.now();
            if (tracing) performance.mark("tilefun.sample.start");
            let last = await new Promise(requestAnimationFrame);
            let previousX = game.stateView.playerEntity.position.wx;
            let previousY = game.stateView.playerEntity.position.wy;
            for (let i = 0; i < count; i++) {
              const now = await new Promise(requestAnimationFrame);
              frames.push(now - last);
              const position = game.stateView.playerEntity.position;
              const distance = Math.hypot(position.wx - previousX, position.wy - previousY);
              travelledPx += distance;
              stationaryMs = distance > 0.01 ? 0 : stationaryMs + now - last;
              maxStationaryMs = Math.max(maxStationaryMs, stationaryMs);
              previousX = position.wx;
              previousY = position.wy;
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
              if (durationMs && performance.now() - sampleStartMs >= durationMs) break;
              if (untilSettled && settledFrames >= 60) {
                settled = true;
                break;
              }
            }
            if (tracing) performance.mark("tilefun.sample.end");
          } finally {
            callbacks.render = render;
            callbacks.update = update;
            game.transport.send = send;
            observer.disconnect();
            for (const restore of restores) restore();
          }
          const summary = (values) => {
            const v = [...values].sort((a, b) => a - b);
            const q = (p) => v[Math.min(v.length - 1, Math.floor(v.length * p))] ?? 0;
            return { count: v.length, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: q(1) };
          };
          const after = game.stateView.playerEntity.position;
          const cadenceMs = summary(frames).p50;
          return {
            ...(timeline ? { frameTimeline } : {}),
            ...(tracing ? { renderTimeline, sampleStartMs } : {}),
            before,
            after: { ...after },
            displayCadenceMs,
            framesOverDisplayCadence: displayCadenceMs
              ? frames.filter((v) => v > displayCadenceMs * 1.5).length
              : null,
            drawCalls: gpuStats ? gpuStats.drawCalls - initialDraws : null,
            terrainPacing: game.debugPanel.terrainPacing,
            zoom: game.camera.zoom,
            maxTerrainRows,
            totalTerrainRows,
            peakPending,
            finalMissing,
            finalIncomplete,
            finalStale,
            staleCacheFrames,
            firstReadyFrame,
            settled: untilSettled ? settled : undefined,
            elapsedMs: frames.reduce((sum, value) => sum + value, 0),
            textureUploadedBytes: gpuStats ? gpuStats.uploadedBytes - initialUpload : null,
            vertexUploadedBytes: gpuStats ? gpuStats.vertexUploadedBytes - initialVertex : null,
            travelledPx,
            maxStationaryMs,
            renderedFrames: renders.length,
            inputAckMs: summary(ackTimes),
            maxAckGap,
            predictionResimulationErrorPx: summary(corrections),
            cache: game.renderer.getDiagnostics?.() ?? null,
            frames: summary(frames),
            renderMs: summary(renders),
            updateMs: summary(updates),
            longTasksMs: summary(tasks),
            cadenceMs,
            framesOverCadence: frames.filter((v) => v > cadenceMs * 1.5).length,
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
        {
          count,
          tracing,
          timeline: tracing || frameTimelineEnabled,
          untilSettled,
          durationMs,
          displayCadenceMs,
        },
      );
      if (tracing) {
        await cdp.send("Tracing.end");
        activeTraceSession = undefined;
        const { stream } = await traceComplete;
        // Browser traces can contain unrelated browser metadata. Keep raw files local.
        const file = await open(path.join(output, `${fixtureName}-${name}-trace.json`), "w", 0o600);
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
      if (profiling) {
        const { profile } = await cdp.send("Profiler.stop");
        await cdp.send("Profiler.disable");
        data.profile = await page.evaluate(() => window.__streamingProfile());
        data.profile.cpu = summarizeCpuProfile(profile);
        await writeFile(
          path.join(output, `${fixtureName}-${name}.cpuprofile`),
          JSON.stringify(profile),
          { mode: 0o600 },
        );
      }
      const result = { name, ...data };
      console.log(JSON.stringify({ version, ...result }));
      return result;
    };
    const samples = [];
    let sprint;
    if (zoomMotion) {
      samples.push(await sample("entry-catchup", 100000, true, settleSeconds * 1000));
      samples.push(await sample("stationary", 100000, false, warmSeconds * 1000));
      if (touch) {
        await move(-1, false, true);
        await move(-1, true);
      } else {
        await page.keyboard.down("ArrowLeft");
        await page.keyboard.down("Shift");
      }
      sprint = await sample("motion", 100000, false, movementSeconds * 1000);
      samples.push(sprint);
      if (touch) await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      else {
        await page.keyboard.up("ArrowLeft");
        await page.keyboard.up("Shift");
      }
      samples.push(await sample("recovery-catchup", 100000, true, settleSeconds * 1000));
      samples.push(await sample("recovery-warm", 100000, false, warmSeconds * 1000));
      await page.screenshot({ path: path.join(output, `${fixtureName}-settled.png`) });
    } else {
      samples.push(await sample("cold", 120));
      await page.screenshot({ path: path.join(output, `${version}-settled.png`) });
      samples.push(await sample("standing", 120));
      if (touch) await move(-1, false, true);
      else await page.keyboard.down("ArrowLeft");
      samples.push(await sample("walk", 180));
      if (touch) await move(-1, true);
      else await page.keyboard.down("Shift");
      sprint = await sample("sprint", sprintFrames);
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
      if (zoomSweep) {
        const presets = await page.evaluate(async () => {
          const { ZOOM_PRESETS } = await import("/tilefun/src/rendering/PresentationSettings.ts");
          return ["2", "1", "0", "3"].map((key) => ZOOM_PRESETS.find((p) => p.key === key));
        });
        for (const preset of presets) {
          if (touch)
            await page.evaluate(
              (zoom) => document.querySelector("#game").__game.debugPanel.setZoom(zoom),
              preset.zoom,
            );
          else await page.keyboard.press(preset.key);
          samples.push(await sample(`zoom-${preset.key}-catchup`, catchupFrames, true));
          samples.push(await sample(`zoom-${preset.key}-warm`, 120));
        }
      }
    }
    // Keep measurements available even when a coverage assertion fails.
    const fixtureFailures = [];
    report.fixtures.push({
      version,
      zoom,
      arrival,
      display,
      displayCadenceMs,
      samples,
      errors,
      failures: fixtureFailures,
      ...(androidCli
        ? {
            thermals: {
              before: thermalsBefore,
              after: readAndroidThermals(androidCli),
              gateMaxBatteryC: maxBatteryC,
            },
          }
        : {}),
    });
    await writeFile(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    if (zoomMotion) {
      if (sprint.travelledPx < movementSeconds * 80 || sprint.maxStationaryMs > 1000)
        fixtureFailures.push("insufficient continuous movement");
      for (const stage of samples) {
        if (stage.name.endsWith("-catchup") && !stage.settled)
          fixtureFailures.push(`${stage.name}: did not settle within ${settleSeconds}s`);
        if (
          stage.name === "recovery-warm" &&
          (stage.totalTerrainRows ||
            stage.missingDataFrames ||
            stage.incompleteCacheFrames ||
            stage.staleCacheFrames)
        )
          fixtureFailures.push("recovery-warm: terrain did not remain ready and idle");
      }
    } else if (Math.abs(sprint.displacement.x) < 256 || sprint.visitedChunks < 6)
      fixtureFailures.push(`traversal failed to cross terrain (${sprint.displacement.x}px)`);
    if (errors.length) fixtureFailures.push("browser page errors (see local report)");
    if (process.argv.includes("--assert-ready")) {
      for (const stage of samples.filter((s) =>
        ["walk", "sprint", "reverse", "motion"].includes(s.name),
      ))
        if (stage.missingDataFrames || stage.incompleteCacheFrames)
          fixtureFailures.push(`${stage.name}: visible terrain was not ready`);
    }
    if (assertBounded) {
      for (const stage of samples) {
        if (stage.maxTerrainRows > 2)
          fixtureFailures.push(`${stage.name}: terrain row cap exceeded`);
        if (stage.name.endsWith("-catchup") && !stage.settled)
          fixtureFailures.push(`${stage.name}: terrain did not catch up`);
        if (
          stage.name.endsWith("-warm") &&
          (stage.totalTerrainRows ||
            stage.finalMissing ||
            stage.finalIncomplete ||
            stage.finalStale)
        )
          fixtureFailures.push(`${stage.name}: warm terrain rebuilt or lost readiness`);
      }
    }
    failures.push(...fixtureFailures.map((f) => `${fixtureName}: ${f}`));
    await writeFile(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    if (endpoint) {
      await page.goto("about:blank");
      await cdp.send("Storage.clearDataForOrigin", { origin: testOrigin, storageTypes: "all" });
      await page.close();
      devicePage = deviceSession = undefined;
    } else await context.close();
  }
  await writeFile(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Report: ${path.join(output, "report.json")}`);
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exitCode = 1;
  }
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
  process.removeListener("SIGINT", interrupt);
  process.removeListener("SIGTERM", interrupt);
}

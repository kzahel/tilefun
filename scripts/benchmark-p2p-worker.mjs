// Short local comparison, not a WAN or physical-device benchmark.
import { execFileSync, fork } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const git = (args) =>
  execFileSync(
    process.platform === "win32" ? "wsl.exe" : "git",
    process.platform === "win32" ? ["git", ...args] : args,
    { encoding: "utf8" },
  );
const output = process.argv.find((arg) => arg.startsWith("--output="))?.slice(9);
if (!output) throw Error("Pass --output=/absolute/path/report.json");
const baselineRef = process.argv.find((arg) => arg.startsWith("--baseline-ref="))?.slice(15);
const modes = process.argv
  .find((arg) => arg.startsWith("--modes="))
  ?.slice(8)
  .split(",") ?? ["single-player", "host-only", "one-guest"];
if (modes.some((mode) => !["single-player", "host-only", "one-guest"].includes(mode)))
  throw Error("Invalid --modes");
// Compare the old launcher/PeerJS host on the current engine without another checkout.
const baselineFiles = baselineRef
  ? new Map(
      ["src/main.ts", "src/transport/PeerHostTransport.ts"].map((file) => [
        file,
        git(["show", `${baselineRef}:${file}`]),
      ]),
    )
  : new Map();
const temp = await mkdtemp(path.join(os.tmpdir(), "tilefun-p2p-bench-"));
let vite, browser, broker;
const report = {
  revision: git(["rev-parse", "HEAD"]).trim(),
  baselineRef: baselineRef ?? null,
  baselineFiles: [...baselineFiles.keys()],
  dirty: !!git(["status", "--porcelain"]).trim(),
  date: new Date().toISOString(),
  platform: `${os.platform()} ${os.arch()} ${os.cpus()[0]?.model}`,
  viewport: { width: 1280, height: 720 },
  limits:
    "Local signaling/full bundled headless Chromium; short warm walking sample; no CPU throttling, WAN or mobile claim.",
  samples: [],
};
const gameReady = (page) =>
  page.waitForFunction(
    () => {
      const g = document.querySelector("#game")?.__game;
      return g?.stateView.playerEntity.id > 0 && g.stateView.world.chunks.loadedCount > 0;
    },
    null,
    { timeout: 30_000 },
  );
try {
  vite = await createServer({
    configFile: false,
    base: "/tilefun/",
    cacheDir: path.join(temp, "vite-cache"),
    optimizeDeps: { entries: ["index.html"] },
    plugins: [
      {
        name: "p2p-baseline-host",
        enforce: "pre",
        transform(_code, id) {
          for (const [file, code] of baselineFiles)
            if (id.endsWith(`/${file}`)) return { code, map: null };
        },
      },
      react(),
    ],
    server: { host: "127.0.0.1", port: 0, hmr: false, watch: null },
    logLevel: "error",
  });
  await vite.listen();
  const origin = `http://127.0.0.1:${vite.httpServer.address().port}/tilefun/`;
  broker = fork(new URL("./p2p-benchmark-broker.mjs", import.meta.url), [], {
    stdio: ["ignore", "ignore", "inherit", "ipc"],
  });
  const [address] = await once(broker, "message", { signal: AbortSignal.timeout(10_000) });
  const peerServer = `http://127.0.0.1:${address.port}/peerjs`;
  browser = await chromium.launch({ channel: "chromium", headless: true });
  report.browser = browser.version();
  for (const mode of modes) {
    const context = await browser.newContext({ viewport: report.viewport });
    const guestContext = await browser.newContext({ viewport: report.viewport });
    const errors = [];
    try {
      const host = await context.newPage();
      host.on("pageerror", (error) => errors.push(error.message));
      const hostId = `bench-${crypto.randomUUID()}`;
      // Resolve the current descriptor from source instead of pinning a retired version.
      await host.goto(`${origin}?nogamepad&perf`);
      const generation = await host.evaluate(async () => {
        const { createDescriptor } = await import(
          "/tilefun/src/generation/GenerationDescriptor.ts"
        );
        return createDescriptor("regional", 2026);
      });
      report.generation = generation;
      const params = new URLSearchParams({
        nogamepad: "",
        perf: "",
        generation: JSON.stringify(generation),
        peerServer,
        playerid: hostId,
      });
      if (mode !== "single-player") params.set("host", "");
      await host.goto(`${origin}?${params}`);
      await host.waitForSelector('#game[data-ready="true"]', { timeout: 30_000 });
      if (mode !== "single-player") {
        await host.getByRole("button", { name: "Back", exact: true }).click();
        await host.getByRole("button", { name: "Worlds", exact: true }).click();
        await host.getByRole("button", { name: "Create new world", exact: true }).click();
      }
      await host.getByRole("button", { name: "New World", exact: true }).click();
      await host.getByTestId("world-menu").waitFor({ state: "hidden" });
      await gameReady(host);
      // Leave the shared spawn before a guest arrives, avoiding overlapping players.
      await host.evaluate(() => {
        window.dispatchEvent(new Event("focus"));
        document
          .querySelector("#game")
          .__game.transport.send({ type: "set-editor-mode", enabled: false });
      });
      await host.waitForFunction(
        () => !document.querySelector("#game").__game.stateView.editorEnabled,
      );
      const spawnX = await host.evaluate(
        () => document.querySelector("#game").__game.stateView.playerEntity.position.wx,
      );
      await host.keyboard.down("ArrowRight");
      await host.waitForFunction(
        (x) => document.querySelector("#game").__game.stateView.playerEntity.position.wx > x + 48,
        spawnX,
        { timeout: 5000 },
      );
      await host.keyboard.up("ArrowRight");
      if (mode === "one-guest") {
        const guest = await guestContext.newPage();
        guest.on("pageerror", (error) => errors.push(error.message));
        await guest.goto(
          `${origin}?${new URLSearchParams({ join: hostId, peerServer, nogamepad: "" })}`,
        );
        await gameReady(guest);
      }
      await host.bringToFront();
      await host.locator("#game").click({ position: { x: 100, y: 100 } });
      await host.evaluate(() => window.dispatchEvent(new Event("focus")));
      await host.evaluate(() =>
        document
          .querySelector("#game")
          .__game.transport.send({ type: "set-editor-mode", enabled: false }),
      );
      await host.waitForFunction(
        () => !document.querySelector("#game").__game.stateView.editorEnabled,
      );
      await host.evaluate(() => new Promise((resolve) => setTimeout(resolve, 2000)));
      await host.keyboard.down("ArrowRight");
      const sample = await host.evaluate(async () => {
        const g = document.querySelector("#game").__game;
        const { performanceMetrics } = await import(
          "/tilefun/src/diagnostics/PerformanceMetrics.ts"
        );
        performanceMetrics.reset();
        const times = [],
          arrivals = [],
          acknowledgments = [];
        let tick = g.stateView.serverTick,
          ack = g.stateView.lastProcessedInputSeq;
        const startTick = tick,
          startAck = ack,
          startPosition = { ...g.stateView.playerEntity.position };
        const start = performance.now();
        while (performance.now() - start < 4000) {
          await new Promise(requestAnimationFrame);
          const now = performance.now();
          times.push(now);
          if (g.stateView.serverTick !== tick) {
            arrivals.push(now);
            tick = g.stateView.serverTick;
          }
          if (g.stateView.lastProcessedInputSeq !== ack) {
            acknowledgments.push(now);
            ack = g.stateView.lastProcessedInputSeq;
          }
        }
        const gaps = (values) => values.slice(1).map((value, i) => value - values[i]);
        const summary = (values) => {
          const sorted = [...values].sort((a, b) => a - b);
          return {
            p95Ms: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
            maxMs: sorted.at(-1) ?? 0,
          };
        };
        return {
          transport: g.transport.getDebugInfo(),
          workers: [],
          durationMs: performance.now() - start,
          frames: times.length,
          framesOver25Ms: gaps(times).filter((ms) => ms > 25).length,
          frameIntervals: summary(gaps(times)),
          authorityArrivalIntervals: summary(gaps(arrivals)),
          inputAckArrivalIntervals: summary(gaps(acknowledgments)),
          tickAdvance: tick - startTick,
          inputAckAdvance: ack - startAck,
          startPosition,
          endPosition: { ...g.stateView.playerEntity.position },
          entities: g.stateView.entities.length,
          chunks: g.stateView.world.chunks.loadedCount,
          mainTimings: performanceMetrics.snapshot(),
          authority: await g.transport.getDiagnostics?.(),
        };
      });
      await host.keyboard.up("ArrowRight");
      if (
        sample.inputAckAdvance < 30 ||
        Math.hypot(
          sample.endPosition.wx - sample.startPosition.wx,
          sample.endPosition.wy - sample.startPosition.wy,
        ) < 10
      )
        throw Error(
          `${mode}: benchmark did not move or acknowledge inputs: ${JSON.stringify(sample)}`,
        );
      sample.workers = host.workers().map((worker) => new URL(worker.url()).pathname);
      report.samples.push({ mode, ...sample, errors });
      console.log(
        JSON.stringify({
          mode,
          frames: sample.frames,
          inputAckAdvance: sample.inputAckAdvance,
          frameIntervals: sample.frameIntervals,
          tickAdvance: sample.tickAdvance,
          errors,
        }),
      );
    } finally {
      await context.close();
      await guestContext.close();
    }
  }
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser?.close();
  await vite?.close();
  if (broker && broker.exitCode === null && broker.signalCode === null) {
    const exited = once(broker, "exit");
    broker.kill("SIGTERM");
    await exited;
  }
  await rm(temp, { recursive: true, force: true });
}

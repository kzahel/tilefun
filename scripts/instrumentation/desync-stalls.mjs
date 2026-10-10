// Controlled diagnostics only: isolated worlds in bundled Chromium or attached phone Chrome.

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright-core";
import { createServer } from "vite";
import { predictedAnimationControl } from "./predicted-animation-control.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const predictedAnimation = process.argv.includes("--predicted-animation");
const extended = process.argv.includes("--extended");
const assertRecovery = process.argv.includes("--assert-recovery");
const endpoint = process.argv.find((arg) => arg.startsWith("--cdp="))?.slice(6);
const port = Number(process.argv.find((arg) => arg.startsWith("--port="))?.slice(7) ?? 0);
if (endpoint && !port) throw Error("Physical CDP requires a dedicated --port");
const output =
  process.argv.find((arg) => arg.startsWith("--output="))?.slice(9) ??
  path.join(os.tmpdir(), "tilefun-desync-stalls");
await mkdir(output, { recursive: true });
const temp = await mkdtemp(path.join(os.tmpdir(), "tilefun-desync-data-"));
for (const key of [
  "WORKSHOP_AUTH_DIR",
  "WORKSHOP_DATA_DIR",
  "ART_NOTES_DIR",
  "INTERIOR_REVIEW_DIR",
])
  process.env[key] = path.join(temp, key);
const server = await createServer({
  root,
  configFile: false,
  base: "/tilefun/",
  optimizeDeps: { entries: ["index.html"] },
  plugins: [
    react(),
    ...(predictedAnimation
      ? [
          {
            name: "predicted-animation-control",
            enforce: "pre",
            transform(code, id) {
              if (id.split("?")[0].endsWith("/src/client/PlayerPredictor.ts"))
                return predictedAnimationControl(code);
            },
          },
        ]
      : []),
  ],
  server: { host: "127.0.0.1", port, strictPort: true, hmr: false },
  logLevel: "error",
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}/tilefun`;
const browser = endpoint
  ? await chromium.connectOverCDP(endpoint, { noDefaults: true })
  : await chromium.launch({ channel: "chromium", headless: true });
const report = {
  date: new Date().toISOString(),
  browser: browser.version(),
  cpu: os.cpus()[0]?.model,
  platform: os.platform(),
  cases: [],
  predictedAnimation,
  physical: !!endpoint,
};
const ownedPages = new Set();
try {
  for (const [kind, ms] of [
    ["baseline", 0],
    ["worker", 350],
    ["worker", 750],
    ["worker", 2500],
    ...(extended
      ? [
          ["worker", 7000],
          ["worker", 9000],
        ]
      : []),
    ["main", 350],
    ["tx-delay", 750],
    ["tx-delay", 2500],
  ]) {
    const context = endpoint
      ? browser.contexts()[0]
      : await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    ownedPages.add(page);
    if (endpoint) {
      await page.bringToFront();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Storage.clearDataForOrigin", {
        origin: new URL(origin).origin,
        storageTypes: "all",
      });
    }
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const generation = { type: "flat", version: "flat-v1", preset: "grass", seed: 2026 };
    await page.goto(
      `${origin}/?perf&nogamepad&generation=${encodeURIComponent(JSON.stringify(generation))}`,
    );
    await page.getByRole("button", { name: "New World", exact: true }).click();
    await page.waitForFunction(() => {
      const g = document.querySelector("#game").__game;
      return (
        g.stateView.playerEntity.id > 0 &&
        g.renderer.getDiagnostics().pending === 0 &&
        !g.mainMenu.visible
      );
    });
    await page.waitForTimeout(300);
    const actualGeneration = await page.locator("#game").getAttribute("data-generation");
    if (JSON.parse(actualGeneration ?? "null")?.type !== "flat")
      throw Error(`Stall control requires the requested flat world: ${actualGeneration}`);
    await page.evaluate(
      ({ kind, ms }) => {
        const g = document.querySelector("#game").__game;
        g.debugPanel.setNoclip(true);
        if (kind === "tx-delay")
          g.netEmulatedTransport.setConfig({
            enabled: true,
            txLossPct: 0,
            rxLossPct: 0,
            txLatencyMs: ms,
            rxLatencyMs: 0,
            txJitterMs: 0,
            rxJitterMs: 0,
          });
        const samples = [];
        const render = g.loop.callbacks.render;
        g.loop.callbacks.render = (a, now) => {
          render(a, now);
          const p = g.stateView.playerEntity,
            pred = g.remoteView._predictor;
          samples.push({
            t: performance.now(),
            x: p.position.wx,
            col: p.sprite?.frameCol,
            timer: p.sprite?.animTimer,
            moving: p.sprite?.moving,
            serverMoving: g.remoteView.serverPlayerEntity.sprite?.moving,
            ack: g.stateView.lastProcessedInputSeq,
            tick: g.stateView.serverTick,
            diag: pred?.lastReconcileDiagnostics,
            recovery: pred?.recoveryDiagnostics,
          });
        };
        window.__samples = samples;
      },
      { kind, ms },
    );
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(300);
    let stall = null;
    if (kind === "worker") {
      const worker = page.workers().find((w) => w.url().includes("local-server.worker"));
      if (!worker) throw Error("No local authority Worker");
      stall = await worker.evaluate((ms) => {
        const start = Date.now();
        while (Date.now() - start < ms) {
          /* controlled CPU saturation */
        }
        return { start, end: Date.now() };
      }, ms);
    }
    if (kind === "main")
      stall = await page.evaluate((ms) => {
        const start = Date.now();
        while (Date.now() - start < ms) {
          /* controlled CPU saturation */
        }
        return { start, end: Date.now() };
      }, ms);
    await page.waitForTimeout(kind === "tx-delay" ? ms + 700 : 700);
    await page.keyboard.up("ArrowRight");
    const data = await page.evaluate(async () => {
      const g = document.querySelector("#game").__game;
      return { samples: window.__samples, host: await g.transport.getDiagnostics() };
    });
    const rows = data.samples;
    const steps = rows.slice(1).map((r, i) => ({ dt: r.t - rows[i].t, dx: r.x - rows[i].x }));
    const moving = rows.filter((r) => r.moving);
    let start = moving[0],
      maxUnchangedWalkFrameMs = 0;
    for (const row of moving) {
      if (row.col !== start.col) start = row;
      maxUnchangedWalkFrameMs = Math.max(maxUnchangedWalkFrameMs, row.t - start.t);
    }
    const summary = {
      kind,
      ms,
      maxUnchangedWalkFrameMs,
      frames: rows.length,
      minDx: Math.min(...steps.map((s) => s.dx)),
      maxDx: Math.max(...steps.map((s) => s.dx)),
      maxFrameMs: Math.max(...steps.map((s) => s.dt)),
      animationCols: [...new Set(rows.filter((r) => r.moving).map((r) => r.col))],
      maxResim: Math.max(0, ...rows.map((r) => r.diag?.resimPosErr ?? 0)),
      maxReplay: Math.max(0, ...rows.map((r) => r.diag?.replayCount ?? 0)),
      maxReplayStepsPerTick: Math.max(0, ...rows.map((r) => r.recovery?.replayStepsThisTick ?? 0)),
      maxRetainedInputs: Math.max(0, ...rows.map((r) => r.recovery?.retainedInputs ?? 0)),
      maxRetainedSeconds: Math.max(0, ...rows.map((r) => r.recovery?.retainedSeconds ?? 0)),
      recoveryStatuses: [...new Set(rows.map((r) => r.recovery?.status).filter(Boolean))],
      errors,
    };
    report.cases.push({ ...summary, generation: JSON.parse(actualGeneration), stall, ...data });
    console.log(JSON.stringify(summary));
    await page.close();
    ownedPages.delete(page);
    if (!endpoint) await context.close();
  }
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  if (assertRecovery) {
    for (const test of report.cases) {
      if (test.errors.length) throw Error(`${test.kind}/${test.ms}: page errors`);
      if (
        test.maxReplayStepsPerTick > 32 ||
        test.maxRetainedInputs > 1024 ||
        test.maxRetainedSeconds > 8.000001
      )
        throw Error(`${test.kind}/${test.ms}: recovery budget exceeded`);
      // Movement is continuously rightward in this flat noclip control. Main
      // stalls are a rendering control; >8s cases characterize overflow recovery.
      if (test.kind !== "main" && test.ms <= 8000 && test.minDx < -0.05)
        throw Error(`${test.kind}/${test.ms}: backward prediction step ${test.minDx}`);
      if (test.kind !== "main" && test.ms <= 8000 && test.maxResim > 0.05)
        throw Error(`${test.kind}/${test.ms}: flat-world replay error ${test.maxResim}`);
    }
  }
} finally {
  for (const page of ownedPages) await page.close().catch(() => {});
  await browser.close();
  await server.close();
  await rm(temp, { recursive: true, force: true });
}

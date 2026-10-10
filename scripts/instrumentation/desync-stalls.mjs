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
try {
  for (const [kind, ms] of [
    ["baseline", 0],
    ["worker", 350],
    ["worker", 750],
    ["worker", 2500],
    ["main", 350],
    ["tx-delay", 750],
    ["tx-delay", 2500],
  ]) {
    const context = endpoint
      ? browser.contexts()[0]
      : await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
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
    const generation = { type: "flat", seed: 2026 };
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
      errors,
    };
    report.cases.push({ ...summary, stall, ...data });
    console.log(JSON.stringify(summary));
    await page.close();
    if (!endpoint) await context.close();
  }
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await server.close();
  await rm(temp, { recursive: true, force: true });
}

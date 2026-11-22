// Real Worker split-screen soak in isolated bundled Chromium. No runtime policy changes.
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const arg = (name, fallback) =>
  process.argv
    .find((a) => a.startsWith(`--${name}=`))
    ?.split("=")
    .slice(1)
    .join("=") ?? fallback;
const seconds = Number(arg("seconds", "60"));
const rates = arg("rates", "1,4,8").split(",").map(Number);
const regional = process.argv.includes("--regional");
const turnSeconds = Number(arg("turn-seconds", "0"));
const txLatencyMs = Number(arg("tx-latency", "0"));
const minimumStepMs = Number(arg("minimum-step-ms", "0"));
if (!(seconds > 0 && seconds <= 600) || !rates.every((r) => r >= 1 && r <= 100) || turnSeconds < 0)
  throw Error("Use seconds in (0,600], rates in [1,100], and a nonnegative turn interval.");
const output = path.resolve(arg("output", path.join(os.tmpdir(), "tilefun-split-pacing")));
const root = path.resolve(import.meta.dirname, "../..");
const temp = await mkdtemp(path.join(os.tmpdir(), "tilefun-split-data-"));
await mkdir(output, { recursive: true });
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
  cacheDir: path.join(temp, "cache"),
  optimizeDeps: { entries: ["index.html"] },
  plugins: [react()],
  server: { host: "127.0.0.1", port: 0, hmr: false, watch: null },
  logLevel: "error",
});
let browser;
const report = {
  revision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  date: new Date().toISOString(),
  seconds,
  rates,
  regional,
  turnSeconds,
  txLatencyMs,
  minimumStepMs,
  note: "Desktop page CPU throttle does not throttle the authority Worker; this is not Chromebook hardware evidence.",
  cases: [],
};
try {
  await server.listen();
  browser = await chromium.launch({ headless: true, channel: "chromium" });
  report.browser = browser.version();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.error(e.message);
  });
  const base = `http://127.0.0.1:${server.httpServer.address().port}/tilefun/`;
  await page.goto(base);
  const generation = await page.evaluate(async (regional) => {
    const { createDescriptor } = await import("/tilefun/src/generation/GenerationDescriptor.ts");
    return createDescriptor(regional ? "regional" : "flat", 2026);
  }, regional);
  const arrival = regional
    ? `&arrival=${encodeURIComponent(JSON.stringify({ x: 300, y: 519, generation }))}`
    : "";
  await page.goto(
    `${base}?nogamepad&generation=${encodeURIComponent(JSON.stringify(generation))}${arrival}`,
  );
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("#game")?.dataset.ready === "true");
  await page.waitForFunction(() => {
    const g = document.querySelector("#game").__game;
    return !g.mainMenu.visible && g.device.prediction?.recoveryDiagnostics.status === "ready";
  });
  console.log(JSON.stringify({ started: generation, errors }));
  if (txLatencyMs)
    await page.evaluate((ms) => {
      document.querySelector("#game").__game.netEmulatedTransport.setConfig({
        enabled: true,
        txLatencyMs: ms,
        rxLatencyMs: 0,
        txLossPct: 0,
        rxLossPct: 0,
        txJitterMs: 0,
        rxJitterMs: 0,
      });
    }, txLatencyMs);
  await page.evaluate(() => {
    const g = document.querySelector("#game").__game;
    const rows = [];
    window.__splitProbe = { rows, enabled: false };
    let presented;
    const begin = g.stateView.beginPresentation;
    g.stateView.beginPresentation = function (...args) {
      begin.apply(this, args);
      presented = this.entities
        .slice(0, 24)
        .map((e) => ({ id: e.id, type: e.type, x: e.position.wx, y: e.position.wy }));
    };
    const render = g.loop.callbacks.render;
    g.loop.callbacks.render = (alpha, now) => {
      render(alpha, now);
      if (!window.__splitProbe.enabled) return;
      const p = g.device.prediction;
      rows.push({
        t: performance.now(),
        tick: g.stateView.serverTick,
        ack: g.stateView.lastProcessedInputSeq,
        input: p?.inputTick,
        applied: p?.appliedInputTick,
        physics: p?.publishedPhysicsTick,
        target:
          p?.replay &&
          Math.max(
            p.replay.request.state.tick,
            (p.replay.targetInputTick ?? p.inputTick) + p.replay.physicsInputOffset,
          ),
        replayPhysics: p?.scene?.physicsTick,
        recovery: p?.recoveryDiagnostics,
        diag: p?.lastReconcileDiagnostics,
        positions: [...g.stateView.seats.entities].map(([seat, id]) => ({
          seat,
          id,
          server: { ...g.stateView.serverEntityMap.get(id)?.position },
          predicted: { ...p?.publishedBody(id).body?.position },
        })),
        presented,
        bodies: g.stateView.physicsState?.bodies.length,
        omitted: g.stateView.physicsState?.omitted,
      });
    };
  });
  if (minimumStepMs)
    await page.evaluate((ms) => {
      const scene = document.querySelector("#game").__game.device.prediction.scene;
      const step = scene.step;
      scene.step = function (...args) {
        const start = performance.now();
        const result = step.apply(this, args);
        while (performance.now() - start < ms) {
          /* controlled private-step CPU cost */
        }
        return result;
      };
    }, minimumStepMs);
  const cdp = await context.newCDPSession(page);
  for (const split of process.argv.includes("--split-only") ? [true] : [false, true]) {
    if (split) {
      await page.keyboard.press("Escape");
      const menu = page.getByTestId("world-menu");
      await menu.getByRole("button", { name: "Multiplayer", exact: true }).click();
      await menu.getByRole("button", { name: "Add Player 2 (keyboard)", exact: true }).click();
      await page.waitForFunction(
        () => document.querySelector("#game").__game.device.views.length === 2,
      );
      await page.keyboard.down("ArrowDown");
      await page.waitForTimeout(700);
      await page.keyboard.up("ArrowDown");
    }
    await page.keyboard.down("d");
    if (split) await page.keyboard.down("ArrowRight");
    for (const rate of rates) {
      await cdp.send("Emulation.setCPUThrottlingRate", { rate });
      await page.waitForTimeout(2000);
      await page.evaluate(() => {
        window.__splitProbe.rows.length = 0;
        window.__splitProbe.enabled = true;
      });
      let direction = 1;
      for (let remaining = seconds; remaining > 0; ) {
        const duration = turnSeconds ? Math.min(remaining, turnSeconds) : remaining;
        await page.waitForTimeout(duration * 1000);
        remaining -= duration;
        if (remaining > 0) {
          await page.keyboard.up(direction > 0 ? "d" : "a");
          if (split) await page.keyboard.up(direction > 0 ? "ArrowRight" : "ArrowLeft");
          direction *= -1;
          await page.keyboard.down(direction > 0 ? "d" : "a");
          if (split) await page.keyboard.down(direction > 0 ? "ArrowRight" : "ArrowLeft");
        }
      }
      await page.keyboard.up(direction > 0 ? "d" : "a");
      if (split) await page.keyboard.up(direction > 0 ? "ArrowRight" : "ArrowLeft");
      await page.keyboard.down("d");
      if (split) await page.keyboard.down("ArrowRight");
      const rows = await page.evaluate(() => {
        window.__splitProbe.enabled = false;
        return window.__splitProbe.rows;
      });
      const summary = { split, rate, frames: rows.length, errors: [...errors] };
      if (rows.length) {
        summary.duration = (rows.at(-1).t - rows[0].t) / 1000;
        summary.serverHz = (rows.at(-1).tick - rows[0].tick) / summary.duration;
        summary.statuses = [...new Set(rows.map((r) => r.recovery?.status))];
        summary.maxHorizon = Math.max(
          0,
          ...rows.map((r) => (r.target === undefined ? 0 : r.target - r.replayPhysics)),
        );
        summary.maxUnpublished = Math.max(...rows.map((r) => r.input - r.applied));
        summary.maxRetained = Math.max(...rows.map((r) => r.recovery?.retainedInputs ?? 0));
        let changedAt = rows[0].t,
          gaps = [],
          changes = 0;
        for (let i = 1; i < rows.length; i++)
          if (rows[i].physics !== rows[i - 1].physics) {
            gaps.push(rows[i].t - changedAt);
            changedAt = rows[i].t;
            changes++;
          }
        gaps.push(rows.at(-1).t - changedAt);
        gaps.sort((a, b) => a - b);
        summary.publishHz = changes / summary.duration;
        summary.maxPublishGapMs = gaps.at(-1);
        summary.p99PublishGapMs = gaps[Math.floor(gaps.length * 0.99)];
      }
      report.cases.push({ summary, rows });
      console.log(JSON.stringify(summary));
      await writeFile(path.join(output, "report.json"), JSON.stringify(report));
    }
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    await page.keyboard.up("d");
    if (split) await page.keyboard.up("ArrowRight");
  }
} finally {
  await browser?.close();
  await server.close();
  await rm(temp, { recursive: true, force: true });
}

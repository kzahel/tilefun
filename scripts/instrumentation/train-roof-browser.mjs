// Real Worker/keyboard reproduction. Hooks observe production behavior only.
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const option = (name, fallback) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const renderer = option("renderer", "canvas");
const delay = Number(option("delay", "0"));
if (!["canvas", "gpu"].includes(renderer) || !Number.isFinite(delay) || delay < 0 || delay > 200)
  throw Error("Use --renderer=canvas|gpu and --delay=0..200 (ms each way)");
const temp = await mkdtemp(path.join(os.tmpdir(), "tilefun-train-prediction-"));
for (const key of [
  "WORKSHOP_AUTH_DIR",
  "WORKSHOP_DATA_DIR",
  "ART_NOTES_DIR",
  "INTERIOR_REVIEW_DIR",
])
  process.env[key] = path.join(temp, key);
const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  plugins: [react()],
  server: { host: "127.0.0.1", port: 0, hmr: false },
  logLevel: "error",
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({
    channel: "chromium",
    headless: !process.argv.includes("--headed"),
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const origin = `http://127.0.0.1:${server.httpServer.address().port}/tilefun/`;
  await page.goto(origin);
  const generation = await page.evaluate(async () => {
    const { createDescriptor } = await import("/tilefun/src/generation/GenerationDescriptor.ts");
    return createDescriptor("regional", 2026);
  });
  await page.goto(
    `${origin}?nogamepad&renderer=${renderer}&generation=${encodeURIComponent(JSON.stringify(generation))}`,
  );
  await page.getByPlaceholder("World name...").fill("Train prediction diagnostic");
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await page.waitForFunction(() => {
    const game = document.querySelector("#game")?.__game;
    return game?.stateView.entities.some((e) => e.type === "train-curve-proof-v1");
  });
  if (await page.evaluate(() => document.querySelector("#game").__game.stateView.editorEnabled))
    await page.keyboard.press("Tab");
  await page.keyboard.down("ArrowDown");
  await page.keyboard.down("Space");
  await page.waitForTimeout(950);
  await page.keyboard.up("ArrowDown");
  await page.keyboard.up("Space");
  await page.waitForFunction(() => {
    const p = document.querySelector("#game").__game.remoteView.serverPlayerEntity;
    return p.wz === 44 && p.jumpVZ === undefined;
  });
  await page.evaluate(
    ({ delay }) => {
      const game = document.querySelector("#game").__game;
      if (delay)
        game.netEmulatedTransport.setConfig({
          enabled: true,
          txLatencyMs: delay,
          rxLatencyMs: delay,
        });
      const predictor = game.remoteView._predictor;
      if (!predictor) throw Error("Missing production predictor");
      const samples = [],
        reconciliations = [],
        inputs = [];
      const reconcile = predictor.reconcile;
      predictor.reconcile = function (...args) {
        const before = { ...this.player.position };
        reconcile.apply(this, args);
        const car = game.remoteView.serverEntities.find((e) => e.type === "train-curve-proof-v1");
        const d = this.lastReconcileDiagnostics;
        reconciliations.push({
          t: performance.now(),
          ...d,
          shiftX: this.player.position.wx - before.wx,
          shiftY: this.player.position.wy - before.wy,
          trainX: car?.position.wx,
          trainY: car?.position.wy,
          trainSpeed: Math.hypot(car?.velocity?.vx ?? 0, car?.velocity?.vy ?? 0),
          trainHeading: car?.sprite?.frameRow,
          serverOffsetX: args[0].position.wx - (car?.position.wx ?? 0),
        });
      };
      const send = game.transport.send;
      game.transport.send = function (message) {
        if (message.type === "player-input")
          inputs.push({
            t: performance.now(),
            seq: message.seq,
            dtMs: message.dtMs,
            dx: message.dx,
            dy: message.dy,
          });
        return send.call(this, message);
      };
      const render = game.loop.callbacks.render;
      game.loop.callbacks.render = (alpha) => {
        render(alpha);
        const car = game.remoteView.serverEntities.find((e) => e.type === "train-curve-proof-v1");
        if (!car) return;
        const player = predictor.player;
        const lerp = (a, b) => a + (b - a) * alpha;
        const px = lerp(predictor.prevPosition.wx, player.position.wx);
        const py = lerp(predictor.prevPosition.wy, player.position.wy);
        const tx = lerp(car.prevPosition?.wx ?? car.position.wx, car.position.wx);
        const ty = lerp(car.prevPosition?.wy ?? car.position.wy, car.position.wy);
        const server = game.remoteView.serverPlayerEntity;
        samples.push({
          t: performance.now(),
          alpha,
          serverTick: game.remoteView.serverTick,
          ack: game.remoteView.lastProcessedInputSeq,
          playerX: px,
          playerY: py,
          trainX: tx,
          trainY: ty,
          offsetX: px - tx,
          offsetY: py - ty,
          serverOffsetX: server.position.wx - car.position.wx,
          z: player.wz,
          serverZ: server.wz,
          heading: car.sprite?.frameRow,
          speed: Math.hypot(car.velocity?.vx ?? 0, car.velocity?.vy ?? 0),
          pending: game.remoteView.pendingMessageCount,
        });
      };
      window.finishTrainProbe = () => {
        predictor.reconcile = reconcile;
        game.transport.send = send;
        game.loop.callbacks.render = render;
        return { samples, reconciliations, inputs };
      };
    },
    { delay },
  );
  await page.waitForTimeout(20000);
  const raw = await page.evaluate(() => window.finishTrainProbe());
  const cruise = raw.samples.filter(
    (sample) => sample.speed > 191.9 && sample.heading === 0 && sample.serverZ === 44,
  );
  const stopped = raw.samples.filter(
    (sample) => sample.speed === 0 && sample.heading === 0 && sample.serverZ === 44,
  );
  const cruiseReconciles = raw.reconciliations.filter(
    (sample) => sample.trainSpeed > 191.9 && sample.trainHeading === 0,
  );
  const stats = (values) => {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    return {
      count: sorted.length,
      min: sorted[0],
      max: sorted.at(-1),
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
    };
  };
  const clockResiduals = [];
  const clockGroups = new Map();
  for (let i = 1; i < raw.reconciliations.length; i++) {
    const a = raw.reconciliations[i - 1],
      b = raw.reconciliations[i];
    if (
      a.trainSpeed < 191.9 ||
      b.trainSpeed < 191.9 ||
      a.trainHeading !== 0 ||
      b.trainHeading !== 0
    )
      continue;
    const acknowledged = b.ackSeq - a.ackSeq;
    const trainTravel = b.trainX - a.trainX;
    const expectedShift = trainTravel - acknowledged * 192 * 0.01667;
    clockResiduals.push(Math.abs(b.shiftX - expectedShift));
    const key = `${b.serverTick - a.serverTick} server ticks / ${acknowledged} acknowledged commands`;
    const group = clockGroups.get(key) ?? [];
    group.push(b.shiftX);
    clockGroups.set(key, group);
  }
  const report = {
    revision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    renderer,
    delayEachWayMs: delay,
    scope:
      "Fresh regional seed 2026, ordinary keyboard roof boarding, real Worker, bundled full Chromium, isolated dev origin; observation hooks, no prediction/authority modifications",
    errors,
    summary: {
      cruiseRenderOffsetX: stats(cruise.map((s) => s.offsetX)),
      cruiseServerOffsetX: stats(cruise.map((s) => s.serverOffsetX)),
      stoppedRenderOffsetX: stats(stopped.map((s) => s.offsetX)),
      cruiseReconcileShiftX: stats(cruiseReconciles.map((s) => s.shiftX)),
      cruiseReconcileShiftAbs: stats(cruiseReconciles.map((s) => Math.hypot(s.shiftX, s.shiftY))),
      cruiseReplayCount: stats(cruiseReconciles.map((s) => s.replayCount)),
      cruiseSpeed: stats(cruise.map((s) => s.speed)),
      commandDtMs: stats(raw.inputs.map((s) => s.dtMs)),
      clockEquationResidualPx: stats(clockResiduals),
      clockGroups: Object.fromEntries(
        [...clockGroups].map(([key, shifts]) => [key, stats(shifts)]),
      ),
    },
    raw,
  };
  const output = option("output", path.join(temp, "report.json"));
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ output, ...report.summary, errors }, null, 2));
  if (cruise.length < 180 || errors.length)
    throw Error("Insufficient steady roof cruise or browser errors");
} finally {
  await browser?.close();
  await server.close();
}

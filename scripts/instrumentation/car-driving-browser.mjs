// Real Worker and keyboard driving; hooks observe production behavior only.
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const option = (name, fallback) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const renderer = option("renderer", "canvas");
const serverHz = Number(option("server-hz", "60"));
if (!["canvas", "gpu"].includes(renderer) || ![30, 60].includes(serverHz))
  throw Error("Use --renderer=canvas|gpu and --server-hz=30|60");
const temp = await mkdtemp(path.join(os.tmpdir(), "tilefun-car-driving-"));
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(30_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const origin = `http://127.0.0.1:${server.httpServer.address().port}/tilefun/`;
  await page.goto(origin);
  const generation = await page.evaluate(async () => {
    const { createDescriptor } = await import("/tilefun/src/generation/GenerationDescriptor.ts");
    return createDescriptor("regional", 2026);
  });
  const arrival = { x: 300, y: 519, generation };
  await page.goto(
    `${origin}?nogamepad&renderer=${renderer}&generation=${encodeURIComponent(JSON.stringify(generation))}&arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
  );
  await page.getByPlaceholder("World name...").fill("Car prediction diagnostic");
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await page.waitForFunction(() =>
    document
      .querySelector("#game")
      ?.__game?.remoteView.serverEntities.some((e) => e.type.startsWith("vehicle-v1:")),
  );
  if (await page.evaluate(() => document.querySelector("#game").__game.stateView.editorEnabled))
    await page.keyboard.press("Tab");
  await page.waitForFunction(
    () => !document.querySelector("#game").__game.remoteView.editorEnabled,
  );
  const direction = await page.evaluate(async () => {
    const g = document.querySelector("#game").__game;
    const car = g.remoteView.serverEntities.find((e) => e.type.startsWith("vehicle-v1:"));
    const direction = car.sprite.direction;
    const dx = direction === 3 ? 1 : direction === 2 ? -1 : 0;
    const dy = direction === 0 ? 1 : direction === 1 ? -1 : 0;
    const x = car.position.wx + dx * (car.collider.width / 2 + 12);
    const y = car.position.wy + car.collider.offsetY + dy * (car.collider.height / 2 + 12);
    await g.gcSendRequest({ type: "rcon", requestId: g.nextRequestId++, command: `tp ${x} ${y}` });
    return direction;
  });
  const enter = page.getByRole("button", { name: "Drive car · E", exact: true });
  await enter.waitFor({ state: "visible" });
  await enter.click();
  await page.waitForFunction(
    () =>
      document.querySelector("#game").__game.remoteView.serverPlayerEntity.parentId !== undefined,
  );
  await page.evaluate(async (hz) => {
    const g = document.querySelector("#game").__game;
    await g.gcSendRequest({
      type: "rcon",
      requestId: g.nextRequestId++,
      command: `sv_tickrate ${hz}`,
    });
  }, serverHz);
  await page.waitForFunction(
    (hz) => Math.abs(document.querySelector("#game").__game.remoteView.tickRate - hz) < 0.001,
    serverHz,
  );
  const actualRenderer = await page.getAttribute("#game", "data-renderer");
  if (actualRenderer !== renderer) throw Error(`Requested ${renderer}, got ${actualRenderer}`);
  await page.evaluate(() => {
    const g = document.querySelector("#game").__game,
      view = g.remoteView;
    const predictor = view._predictor;
    const rows = [],
      renders = [];
    window.__carProbe = { rows, renders };
    const reconcile = predictor.reconcile.bind(predictor);
    let previous;
    predictor.reconcile = (...args) => {
      const before = { ...predictor.mount.position };
      const entity = view.serverEntities.find((e) => e.id === view.serverPlayerEntity.parentId);
      const current = {
        tick: view.serverTick,
        ack: view.lastProcessedInputSeq,
        x: entity.position.wx,
        y: entity.position.wy,
        vx: entity.velocity.vx,
        vy: entity.velocity.vy,
      };
      reconcile(...args);
      rows.push({
        time: performance.now(),
        ...current,
        tickGap: previous ? current.tick - previous.tick : 0,
        ackGap: previous ? current.ack - previous.ack : 0,
        authorityAdvance: previous ? Math.hypot(current.x - previous.x, current.y - previous.y) : 0,
        shift: Math.hypot(
          predictor.mount.position.wx - before.wx,
          predictor.mount.position.wy - before.wy,
        ),
        previousSpeed: previous ? Math.hypot(previous.vx, previous.vy) : 0,
        speed: Math.hypot(current.vx, current.vy),
      });
      previous = current;
    };
    const end = view.endPresentation.bind(view);
    view.endPresentation = (...args) => {
      const entity = view.entities.find((e) => e.id === predictor.mount.id);
      const alpha = g.time.alpha,
        prev = entity.prevPosition ?? entity.position;
      renders.push({
        time: g.time.presentationSeconds,
        x: prev.wx + (entity.position.wx - prev.wx) * alpha,
        y: prev.wy + (entity.position.wy - prev.wy) * alpha,
      });
      return end(...args);
    };
  });
  const key = ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"][direction];
  await page.keyboard.down(key);
  await page.waitForTimeout(8000);
  await page.keyboard.up(key);
  const capture = await page.evaluate(() => window.__carProbe);
  const cruise = capture.rows.filter((r) => r.previousSpeed > 100 && r.speed > 90);
  const missing = cruise.filter((r) => r.ackGap === 0 && r.tickGap === 1);
  const summary = {
    renderer: actualRenderer,
    serverHz,
    reconciliationSamples: capture.rows.length,
    cruiseSamples: cruise.length,
    missingInputCruiseFrames: missing.length,
    maxMotionWithoutAckPx: Math.max(0, ...missing.map((r) => r.authorityAdvance)),
    maxCruiseReconcileShiftPx: Math.max(0, ...cruise.map((r) => r.shift)),
    renderFrames: capture.renders.length,
    errors,
  };
  const output = option("output", path.join(temp, "capture.json"));
  await writeFile(
    output,
    `${JSON.stringify({ scope: "Eight seconds of real Worker keyboard driving in an isolated fresh regional world; no timing/input injection. Cruise filtering excludes hard stops but cannot rule out every nearby contact.", summary, ...capture }, null, 2)}\n`,
  );
  console.log(JSON.stringify({ output, ...summary }, null, 2));
  if (errors.length || cruise.length < 30) throw Error("Native diagnostic missed clear driving");
} finally {
  await browser?.close();
  await server.close();
}

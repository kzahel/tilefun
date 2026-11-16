// Reproduce first-person driving fog with Far selected in an isolated world.
// Bundled Chromium only; traffic contacts make the driven route vary.
// node scripts/first-person/fog-traversal.mjs [--flat] [--headed]
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const steps = (name, fallback) => {
  const value = Number(
    process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1] ?? fallback,
  );
  if (!Number.isSafeInteger(value) || value < 1) throw Error(`Invalid --${name}`);
  return value;
};
const outSteps = steps("out-steps", 16);
const backSteps = steps("back-steps", 40);
const out = await mkdtemp(path.join(os.tmpdir(), "tilefun-town-fog-long-"));
const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  cacheDir: path.join(out, "cache"),
  optimizeDeps: { entries: ["index.html"] },
  plugins: [react()],
  server: { host: "127.0.0.1", port: 0, hmr: false, watch: null },
  logLevel: "error",
});
let browser;
const report = {
  out,
  fixture: process.argv.includes("--flat") ? "flat" : "regional-2026",
  outSteps,
  backSteps,
  samples: [],
  errors: [],
};
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}/tilefun`;
  browser = await chromium.launch({
    headless: !process.argv.includes("--headed"),
    channel: "chromium",
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("pageerror", (e) => report.errors.push(e.message));
  await page.goto(`${origin}/?nogamepad&view=fps`);
  await page.waitForFunction(
    () => document.querySelector("#game")?.dataset.ready === "true",
    undefined,
    { timeout: 60000 },
  );
  await page.evaluate(async (flat) => {
    const g = document.querySelector("#game").__game;
    const { createDescriptor } = await import("/tilefun/src/generation/GenerationDescriptor.ts");
    const generation = flat
      ? { type: "flat", version: "flat-v1", seed: 42, preset: "grass" }
      : createDescriptor("regional", 2026);
    const created = await g.gcSendRequest({
      type: "create-world",
      requestId: g.nextRequestId++,
      name: "Fog reproduction",
      generation,
    });
    await g.gcSendRequest({
      type: "join-realm",
      requestId: g.nextRequestId++,
      worldId: created.meta.id,
      arrival: { x: 300, y: 519, generation },
    });
  }, process.argv.includes("--flat"));
  await page.waitForFunction(
    () =>
      Math.abs(
        document.querySelector("#game").__game.stateView.serverPlayerEntity.position.wx - 4800,
      ) < 1,
  );
  await page.evaluate(() => {
    const g = document.querySelector("#game").__game;
    g.firstPerson.viewDistance = "far";
    g.firstPerson.look.yaw = 0;
    g.transport.send({ type: "set-editor-mode", enabled: true });
    g.transport.send({
      type: "edit-spawn",
      entityType: "vehicle-v1:compact-1",
      wx: 4848,
      wy: 8304,
    });
    g.transport.send({ type: "set-editor-mode", enabled: false });
  });
  await page.getByRole("button", { name: /^Drive car/ }).click();
  await page.evaluate(() => document.activeElement?.blur());
  const sample = async (label, shot = false) => {
    const s = await page.evaluate(async () => {
      const g = document.querySelector("#game").__game,
        p = g.stateView.playerEntity,
        sp = g.stateView.serverPlayerEntity;
      const car = g.stateView.entities.find((e) => e.id === p.parentId);
      const world = g.stateView.world;
      const { chunksInReach } = await import(
        "/tilefun/src/rendering/firstperson/FirstPersonChunks.ts"
      );
      const view = g.device.views[0];
      const eye = view.policy.eye(g.device, g.firstPerson.look, 1);
      if (!car || !eye) throw Error("Expected a seated driver and first-person eye");
      const missing = chunksInReach(eye.x, eye.y, 1856).filter(
        (c) => !world.getChunkIfLoaded(c.cx, c.cy),
      );
      const cx = Math.floor((car?.position.wx ?? p.position.wx) / 256),
        cy = Math.floor((car?.position.wy ?? p.position.wy) / 256);
      return {
        missing: missing.slice(0, 4),
        player: { ...p.position },
        serverPlayer: { ...sp.position },
        parent: p.parentId,
        car: car && { ...car.position },
        camera: { x: g.camera.x, y: g.camera.y },
        range: g.device.views[0].interestRange(),
        stats: g.firstPerson.viewStats,
        nearChunks: [-1, 0, 1].flatMap((dx) =>
          [-1, 0, 1].map((dy) => ({
            cx: cx + dx,
            cy: cy + dy,
            loaded: !!world.getChunkIfLoaded(cx + dx, cy + dy),
          })),
        ),
      };
    });
    report.samples.push({ label, ...s });
    console.log(
      JSON.stringify({ label, car: s.car, fogEnd: s.stats.fogEnd, nearestMissing: s.missing[0] }),
    );
    if (shot) await page.screenshot({ path: path.join(out, `${label}.png`) });
  };
  await page.waitForTimeout(4000);
  await sample("start", true);
  await page.keyboard.down("w");
  for (let i = 0; i < outSteps; i++) {
    await page.waitForTimeout(2500);
    await sample(`out-${i}`, i === outSteps - 1);
  }
  await page.keyboard.up("w");
  await page.waitForTimeout(5000);
  await sample("far-stopped", true);
  await page.keyboard.down("s");
  for (let i = 0; i < backSteps; i++) {
    await page.waitForTimeout(2500);
    await sample(`back-${i}`, i % 4 === 3);
  }
  await page.keyboard.up("s");
  await page.waitForTimeout(10000);
  await sample("return-stopped", true);
  report.storage = await page.evaluate(async () => {
    const g = document.querySelector("#game").__game;
    return g.gcSendRequest({
      type: "rcon",
      requestId: g.nextRequestId++,
      command: "storage_stats",
    });
  });
} catch (error) {
  report.errors.push(String(error?.stack ?? error));
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server.close();
  await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  await rm(path.join(out, "cache"), { recursive: true, force: true });
  console.log(`REPORT ${out}/report.json`);
}

if (report.errors.length) process.exitCode = 1;

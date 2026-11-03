// Isolated ordinary-Worker movement capture on empty flat terrain.
// Two fresh production sessions exercise independent Worker/render phases; no runtime patches.
// Run: node scripts/instrumentation/movement-pacing.mjs --output=/tmp/tilefun-pacing
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const root = fileURLToPath(new URL("../..", import.meta.url));
const revision = execFileSync(
  process.platform === "win32" ? "wsl.exe" : "git",
  process.platform === "win32" ? ["git", "rev-parse", "HEAD"] : ["rev-parse", "HEAD"],
  { cwd: root, encoding: "utf8" },
).trim();
const captureDir = path.resolve(
  process.argv.find((a) => a.startsWith("--output="))?.slice("--output=".length) ??
    path.join(os.tmpdir(), "tilefun-movement-pacing"),
);
await mkdir(captureDir, { recursive: true });
const temp = await mkdtemp(path.join(os.tmpdir(), "tilefun-211-"));
for (const k of ["WORKSHOP_AUTH_DIR", "WORKSHOP_DATA_DIR", "ART_NOTES_DIR", "INTERIOR_REVIEW_DIR"])
  process.env[k] = path.join(temp, k);
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
const output = [];
try {
  await server.listen();
  const base = `http://127.0.0.1:${server.httpServer.address().port}/tilefun/`;
  browser = await chromium.launch({ headless: true, channel: "chromium" });
  for (const mode of ["production", "production-repeat"]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const generation = { type: "flat", version: "flat-v1", seed: 1, preset: "grass" };
    await page.goto(
      base +
        `?nogamepad&renderer=gpu&meshes&generation=${encodeURIComponent(JSON.stringify(generation))}`,
    );
    await page.getByRole("button", { name: "New World", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("#game")?.dataset.ready === "true");
    await page.getByTestId("main-menu-toggle").click();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.evaluate(() => {
      const g = document.querySelector("#game").__game;
      for (const e of g.stateView.entities)
        if (e.type !== "player") g.transport.send({ type: "edit-delete-entity", entityId: e.id });
    });
    await page.getByRole("button", { name: "Exit editor", exact: true }).click();
    await page.evaluate(() => {
      const g = document.querySelector("#game").__game;

      window.__movementProbe = { rows: [], enabled: false };
      let presented, camera, renderedDraw, terrainDraw;
      const collectTerrain = g.renderer.collectTerrain;
      g.renderer.collectTerrain = function (...args) {
        const draws = collectTerrain.apply(this, args);
        terrainDraw = draws[0] ? { ...draws[0] } : undefined;
        return draws;
      };
      const surface = g.renderer.surface;
      const drawImage = surface.drawImage;
      surface.drawImage = function (image, ...args) {
        const player = g.stateView.playerEntity;
        if (
          window.__movementProbe.enabled &&
          player.parentId === undefined &&
          image === g.renderer.sheets.get(player.sprite?.sheetKey)?.image &&
          args.length === 8
        )
          renderedDraw = {
            kind: "sprite",
            x: args[4],
            y: args[5],
            width: args[6],
            height: args[7],
          };
        return drawImage.call(this, image, ...args);
      };
      const drawTexture = surface.drawTexture;
      surface.drawTexture = function (texture, x, y, width, height) {
        if (window.__movementProbe.enabled && g.stateView.playerEntity.parentId !== undefined)
          renderedDraw = { kind: "mesh", x, y, width, height };
        return drawTexture.call(this, texture, x, y, width, height);
      };
      const begin = g.remoteView.beginPresentation;
      g.remoteView.beginPresentation = function (...args) {
        begin.apply(this, args);
        const e = this.presentedPlayerEntity;
        presented = { x: e.position.wx, y: e.position.wy, z: e.wz ?? 0 };
      };
      const follow = g.camera.presentFollow;
      g.camera.presentFollow = function (...args) {
        follow.apply(this, args);
        camera = { x: this.x, y: this.y, time: args[0] };
      };
      const callbacks = g.loop.callbacks,
        render = callbacks.render;
      callbacks.render = (alpha, time) => {
        const start = performance.now();
        renderedDraw = undefined;
        render(alpha, time);
        if (!window.__movementProbe.enabled) return;
        const p = g.remoteView._predictor,
          player = g.stateView.playerEntity,
          diag = g.stateView.predictionDiagnostics;
        const scale = g.camera.scale,
          tx = g.camera.pixelSnap
            ? Math.round(g.camera.viewportWidth / 2 - camera.x * scale)
            : g.camera.viewportWidth / 2 - camera.x * scale;
        window.__movementProbe.rows.push({
          time,
          alpha,
          startMs: start,
          renderMs: performance.now() - start,
          presented,
          camera,
          renderedDraw,
          terrainDraw,
          raw: {
            x: player.position.wx,
            y: player.position.wy,
            prevX: player.prevPosition?.wx,
            prevY: player.prevPosition?.wy,
            vx: player.velocity?.vx,
            vy: player.velocity?.vy,
          },
          ack: g.stateView.lastProcessedInputSeq,
          diag,
          displayError: { ...p.displayError },
          error: p.error(),
          physicsTick: p.scene?.physicsTick,
          inputTick: p.inputTick,
          ackInputTick: p.ackInputTick,
          appliedInputTick: p.appliedInputTick,
          screenX: presented.x * scale + tx,
          screenXUnsnapped: (presented.x - camera.x) * scale + g.camera.viewportWidth / 2,
          terrainScreenX: tx,
          pixelSnap: g.camera.pixelSnap,
          scale,
        });
      };
    });
    async function sample(name, warm = 45) {
      await page.evaluate(async (count) => {
        for (let i = 0; i < count; i++) await new Promise(requestAnimationFrame);
      }, warm);
      const rows = await page.evaluate(async () => {
        const s = window.__movementProbe;
        s.rows = [];
        s.enabled = true;
        for (let i = 0; i < 240; i++) await new Promise(requestAnimationFrame);
        s.enabled = false;
        return s.rows;
      });
      if (errors.length) throw Error(errors.join("\n"));
      output.push({ mode, name, rows, errors });
      console.log(JSON.stringify({ mode, name, rows: rows.length, errors }));
      await writeFile(
        path.join(captureDir, "report.json"),
        JSON.stringify(
          {
            version: 1,
            revision,
            browser: browser.version(),
            headless: true,
            renderer: "gpu",
            meshes: true,
            cpuRate: 1,
            viewport: { width: 1280, height: 900 },
            cases: output,
          },
          null,
          2,
        ),
      );
    }
    await page.keyboard.down("d");
    await sample("walk");
    await page.keyboard.up("d");
    // Capture immediately: the world/player can be stationary while follow settles.
    await sample("stop", 0);
    await page.keyboard.down("d");
    await page.keyboard.down("Shift");
    await sample("run");
    await page.keyboard.up("Shift");
    await page.keyboard.up("d");
    await page.getByTestId("main-menu-toggle").click();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.evaluate(() => {
      const g = document.querySelector("#game").__game,
        p = g.stateView.playerEntity.position;
      g.transport.send({
        type: "edit-spawn",
        entityType: "vehicle-v1:compact-1",
        wx: p.wx + 44,
        wy: p.wy,
      });
    });
    await page.getByRole("button", { name: "Exit editor", exact: true }).click();
    await page.getByRole("button", { name: /^Drive car/ }).click();
    await page.keyboard.down("d");
    await sample("car", 90);
    await page.keyboard.up("d");
    await context.close();
  }
} finally {
  await browser?.close();
  await server.close();
  await rm(temp, { recursive: true, force: true });
}

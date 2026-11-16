// Reproduce the late one-pixel camera pop in actual unified-view pixels, then
// replay the same walk/stop with production Camera.presentFollow. World time is
// frozen by the renderer film; only the player and camera move. The old filter
// is advanceCameraFollow's unbounded (zero settle-distance) diagnostic mode.
// node scripts/first-person/settling.mjs [--out=/tmp/tilefun-settling] [--headless]
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright-core";
import { PNG } from "pngjs";
import { createServer } from "vite";

const output = path.resolve(
  process.argv.find((arg) => arg.startsWith("--out="))?.slice(6) ??
    path.join(os.tmpdir(), "tilefun-settling"),
);
await mkdir(output, { recursive: true });
const temp = await mkdtemp(path.join(os.tmpdir(), "tilefun-settling-"));
const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  cacheDir: path.join(temp, "cache"),
  optimizeDeps: { entries: ["index.html"] },
  plugins: [react()],
  server: { host: "127.0.0.1", port: 0, hmr: false, watch: null },
  logLevel: "error",
});
const hz = 60;
const stopAt = 90;
const frames = 240;
const report = { date: new Date().toISOString(), hz, stopAt, errors: [], cells: [] };
let browser;
try {
  await server.listen();
  browser = await chromium.launch({
    headless: process.argv.includes("--headless"),
    channel: "chromium",
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("pageerror", (error) => report.errors.push(error.message));
  const base = `http://127.0.0.1:${server.httpServer.address().port}/tilefun`;
  await page.goto(`${base}/tools.html`);
  const generation = await page.evaluate(async () => {
    const { createDescriptor } = await import("/tilefun/src/generation/GenerationDescriptor.ts");
    return createDescriptor("regional", 2026);
  });
  const arrival = { x: -380, y: -364, generation };
  await page.goto(
    `${base}/?nogamepad&view=topdown3d&generation=${encodeURIComponent(JSON.stringify(generation))}&arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
  );
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector("#game");
      return canvas?.dataset.ready === "true" && !canvas.__game.mainMenu.visible;
    },
    undefined,
    { timeout: 120_000 },
  );
  await page.waitForTimeout(2500);
  report.renderer = await page.evaluate(() => {
    let name;
    document.querySelector("#game").__game.renderHost.view3d.draw(undefined, ({ renderer }) => {
      const gl = renderer.getContext();
      const debug = gl.getExtension("WEBGL_debug_renderer_info");
      name = gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
    });
    return name;
  });
  await page.evaluate(() => {
    document.querySelector("#game").__game.debugPanel.pauseCheckbox.checked = true;
  });
  for (const zoom of [1, 0.5]) {
    await page.evaluate((z) => document.querySelector("#game").__game.debugPanel.setZoom(z), zoom);
    await page.waitForFunction(() => {
      const g = document.querySelector("#game").__game;
      return g.firstPerson.drawing3d && g.renderer.getDiagnostics().pending === 0;
    });
    await page.waitForTimeout(2000);
    const options = {
      step: { x: 0, y: 0 },
      from: 0,
      count: 0,
      columns: ["rigid"],
      crop: { width: 160, height: 120 },
      enlarge: 2,
    };
    const start = await page.evaluate(
      async (o) => (await document.querySelector("#game").__parityFilm(o)).start,
      options,
    );
    const stats = {};
    for (const mode of ["before", "after"]) {
      const dir = path.join(output, `${mode}-${zoom}`);
      await mkdir(dir, { recursive: true });
      let previous;
      let lastChange = stopAt;
      const changes = [];
      const samples = [];
      for (let from = 0; from < frames; from += 20) {
        const part = await page.evaluate(
          async ({ options, start, mode, zoom, hz, stopAt, from }) => {
            const { Camera } = await import("/tilefun/src/rendering/Camera.ts");
            const { advanceCameraFollow } = await import("/tilefun/src/rendering/CameraFollow.ts");
            const canvas = document.querySelector("#game");
            const camera = new Camera();
            camera.zoom = zoom;
            // End 0.0001 screen pixels beyond a rounding boundary. Choose a
            // nearby stop so both runs draw the same trees and ground.
            const end = (Math.floor(start.camera.x * camera.scale) + 0.5001) / camera.scale;
            let old = null;
            const result = [];
            for (let n = 0; n < from + 20; n++) {
              const time = n / hz;
              const x = end - (64 * Math.max(0, stopAt - n)) / hz;
              camera.presentFollow(time, x, start.camera.y, "probe");
              old = advanceCameraFollow(old, time, x, start.camera.y);
              if (n < from) continue;
              const at = mode === "after" ? camera : old;
              const frame = await canvas.__parityFilm({
                ...options,
                count: 1,
                start: {
                  ...start,
                  camera: { x: at.x, y: at.y },
                  player: { wx: start.player.wx + x - start.camera.x, wy: start.player.wy },
                },
              });
              result.push({ x: at.x, target: x, image: frame.frames[0] });
            }
            return result;
          },
          { options, start, mode, zoom, hz, stopAt, from },
        );
        for (const [index, frame] of part.entries()) {
          const n = from + index;
          const buffer = Buffer.from(frame.image.split(",")[1], "base64");
          const png = PNG.sync.read(buffer);
          // Exclude the film's diagnostic text above the actual game pixels.
          const pixels = png.data.subarray(28 * png.width * 4);
          const cropped = new PNG({ width: png.width, height: png.height - 28 });
          cropped.data = Buffer.from(pixels);
          await writeFile(
            path.join(dir, `${String(n).padStart(4, "0")}.png`),
            PNG.sync.write(cropped),
          );
          if (n >= stopAt && previous && !pixels.equals(previous)) {
            changes.push({ frame: n, gapMs: ((n - lastChange) * 1000) / hz });
            lastChange = n;
          }
          previous = pixels;
          samples.push({ frame: n, x: frame.x, target: frame.target });
        }
      }
      stats[mode] = {
        longestStillGapMs: Math.max(0, ...changes.map((c) => c.gapMs)),
        lastPixelChangeAfterStopMs: ((lastChange - stopAt) * 1000) / hz,
        changes,
        samples,
      };
    }
    report.cells.push({ zoom, ...stats });
    console.log(
      zoom,
      JSON.stringify({
        before: stats.before.longestStillGapMs,
        after: stats.after.longestStillGapMs,
      }),
    );
    execFileSync("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-framerate",
      String(hz),
      "-i",
      path.join(output, `before-${zoom}`, "%04d.png"),
      "-framerate",
      String(hz),
      "-i",
      path.join(output, `after-${zoom}`, "%04d.png"),
      "-filter_complex",
      "hstack",
      "-c:v",
      "libx264",
      "-crf",
      "10",
      "-pix_fmt",
      "yuv420p",
      path.join(output, `before-after-${zoom}.mp4`),
    ]);
  }
  await writeFile(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  assert.deepEqual(report.errors, []);
  for (const cell of report.cells) {
    assert.ok(cell.before.longestStillGapMs > 1000, "must reproduce the old delayed pop in pixels");
    assert.ok(cell.after.longestStillGapMs <= 150, "no delayed pixel step after a still interval");
    assert.ok(cell.after.lastPixelChangeAfterStopMs <= 750, "must finish settling");
    const last = cell.after.samples.at(-1);
    assert.equal(last.x, last.target, "must reach the exact target");
  }
} finally {
  await browser?.close().catch(() => {});
  await server.close().catch(() => {});
  await rm(temp, { recursive: true, force: true });
}

// Renderer film: enlarged, side-by-side video of the fixed view and the 3D
// scene's top-down camera while the camera pans with the player, to judge pixel
// shimmer, registration and edges by eye. An isolated Vite server, bundled
// Chromium and a fresh regional world with `?view=topdown3d`, as parity.mjs.
//
//   node scripts/first-person/film.mjs [--out=DIR] [--headless] [--scenes=woods,city]
//     [--zooms=1,0.5] [--speed=64] [--direction=20] [--seconds=4] [--fps=60]
//     [--columns=fixed,scene] [--crop=240x160] [--enlarge=4] [--query=a=b]
//     [--others=0] [--others-direction=200] [--stop=SECONDS]
//     [--spawn=TYPE@DX,DY;TYPE@DX,DY] (entities or props placed round the player)
//
// Entities are paused and presentation time stands still, so frame N is the same
// picture on every run; only the camera (and the player with it) moves, `--speed`
// world pixels a second (the player walks at 64) toward `--direction` degrees
// (0 east, 90 south); `--others` moves every other entity the same way, so
// NPCs and cars cross the view at their own speed. Columns: `fixed`, `rigid`
// (3D as played: one pixel grid for camera, bodies and blades), `scene` (3D with
// sub-pixel placement, as before the grid), `snapped` (only the camera on whole
// screen pixels) and `nearest` (sub-pixel, ground sampled once per pixel). Writes
// one MP4 per scene and zoom, and keeps the PNG frames beside it.
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const option = (name, fallback) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
// The render bench's scenes (tactical 236) and the parity runner's pond.
// `traffic` is the city with cars, rabbits and people placed around the player.
const SCENES = {
  city: { arrival: [300, 519] },
  woods: { arrival: [-380, -364] },
  pond: { arrival: [215, -196] },
  traffic: { arrival: [300, 519], spawn: true },
  // Ferngrove Motocross (seed 2026): the north straight's jumps.
  motocross: { arrival: [44, 452] },
};
const scenes = option("scenes", "woods,city").split(",");
for (const name of scenes) if (!SCENES[name]) throw Error(`Unknown scene ${name}`);
const zooms = option("zooms", "1,0.5").split(",").map(Number);
const fps = Number(option("fps", "60"));
const frames = Math.round(Number(option("seconds", "4")) * fps);
const speed = Number(option("speed", "64"));
const direction = (Number(option("direction", "20")) * Math.PI) / 180;
const step = { x: (speed / fps) * Math.cos(direction), y: (speed / fps) * Math.sin(direction) };
// `--stop=S`: the player walks for S seconds then stops, and the camera trails
// it as play's follow does (the moment layers settle).
const stopSeconds = option("stop", "");
const stopAt = stopSeconds === "" ? undefined : Math.round(Number(stopSeconds) * fps);
const othersSpeed = Number(option("others", "0"));
const othersDirection = (Number(option("others-direction", "200")) * Math.PI) / 180;
const others = {
  x: (othersSpeed / fps) * Math.cos(othersDirection),
  y: (othersSpeed / fps) * Math.sin(othersDirection),
};
const columns = option("columns", "fixed,rigid").split(",");
const [cropWidth, cropHeight] = option("crop", "240x160").split("x").map(Number);
const enlarge = Number(option("enlarge", "4"));
const query = option("query", "");
const extraSpawns = option("spawn", "")
  .split(";")
  .filter(Boolean)
  .map((entry) => {
    const [entityType, at] = entry.split("@");
    const [dx, dy] = (at ?? "0,0").split(",").map(Number);
    return { entityType, dx, dy };
  });
const output = path.resolve(option("out", path.join(os.tmpdir(), "tilefun-film")));
await mkdir(output, { recursive: true });
const temp = await mkdtemp(path.join(os.tmpdir(), "tilefun-film-"));

const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  cacheDir: path.join(temp, "vite-cache"),
  optimizeDeps: { entries: ["index.html"] },
  plugins: [react()],
  server: { host: "127.0.0.1", port: 0, hmr: false, watch: null },
  logLevel: "error",
});
let browser;
const errors = [];
const videos = [];
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}/tilefun`;
  // Headed by default: the GPU draws as on a player's screen.
  browser = await chromium.launch({
    headless: process.argv.includes("--headless"),
    channel: "chromium",
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/tools.html`);
  const generation = await page.evaluate(async () => {
    const { createDescriptor } = await import("/tilefun/src/generation/GenerationDescriptor.ts");
    return createDescriptor("regional", 2026);
  });
  for (const name of scenes) {
    const [x, y] = SCENES[name].arrival;
    const arrival = { x, y, generation };
    await page.goto("about:blank");
    await page.goto(
      `${origin}/?nogamepad&view=topdown3d${query ? `&${query}` : ""}&generation=${encodeURIComponent(
        JSON.stringify(generation),
      )}&arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
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
    // Arrival finishes after the first ready frame; then freeze entities, so the
    // parts of a film read in separate tasks show the same world.
    await page.waitForTimeout(2500);
    if (extraSpawns.length) {
      await page.evaluate((spawns) => {
        const g = document.querySelector("#game").__game;
        const p = g.stateView.playerEntity.position;
        g.transport.send({ type: "set-editor-mode", enabled: true });
        for (const { entityType, dx, dy } of spawns)
          g.transport.send({ type: "edit-spawn", entityType, wx: p.wx + dx, wy: p.wy + dy });
        g.transport.send({ type: "set-editor-mode", enabled: false });
      }, extraSpawns);
      await page.waitForTimeout(3000);
    }
    if (SCENES[name].spawn) {
      await page.evaluate(async () => {
        const g = document.querySelector("#game").__game;
        const p = g.stateView.playerEntity.position;
        const at = (entityType, dx, dy) => ({ entityType, wx: p.wx + dx, wy: p.wy + dy });
        const spawns = [
          at("vehicle-v1:compact-1", -70, -40),
          at("vehicle-v1:police-car", 60, -45),
          at("vehicle-v1:beetle", -40, 50),
          at("vehicle-v1:rosso-coupe", 90, 40),
          at("person3", -25, -10),
          at("person7", 30, 12),
          at("person11", 10, -30),
          at("person13", -55, 20),
        ];
        for (let i = 0; i < 10; i++)
          spawns.push(at("wildlife-rabbit-v1", -60 + i * 14, 28 - (i % 3) * 9));
        g.transport.send({ type: "set-editor-mode", enabled: true });
        for (const spawn of spawns) g.transport.send({ type: "edit-spawn", ...spawn });
        g.transport.send({ type: "set-editor-mode", enabled: false });
      });
      await page.waitForTimeout(3000);
    }
    await page.evaluate(() => {
      document.querySelector("#game").__game.debugPanel.pauseCheckbox.checked = true;
    });
    for (const zoom of zooms) {
      await page.evaluate(
        (z) => document.querySelector("#game").__game.debugPanel.setZoom(z),
        zoom,
      );
      await page
        .waitForFunction(
          () => {
            const g = document.querySelector("#game").__game;
            const terrain = g.renderer.getDiagnostics();
            const view = g.firstPerson.viewStats;
            return (
              g.firstPerson.drawing3d &&
              terrain.pending === 0 &&
              terrain.rowsLastFrame === 0 &&
              view?.builds === 0
            );
          },
          undefined,
          { timeout: 60_000, polling: 250 },
        )
        .catch(() => errors.push(`${name} ${zoom}: did not settle`));
      await page.waitForTimeout(2000);
      const dir = path.join(output, `${name}-${zoom}`);
      await rm(dir, { recursive: true, force: true });
      await mkdir(dir, { recursive: true });
      let start;
      for (let from = 0; from < frames; from += 20) {
        const part = await page.evaluate(
          (options) => document.querySelector("#game").__parityFilm(options),
          {
            start,
            step,
            others,
            stopAt,
            frameSeconds: 1 / fps,
            from,
            count: Math.min(20, frames - from),
            columns,
            crop: { width: cropWidth, height: cropHeight },
            enlarge,
          },
        );
        start = part.start;
        for (const [index, url] of part.frames.entries())
          await writeFile(
            path.join(dir, `${String(from + index).padStart(4, "0")}.png`),
            Buffer.from(url.slice(url.indexOf(",") + 1), "base64"),
          );
      }
      const video = path.join(output, `${name}-${zoom}.mp4`);
      execFileSync(
        "ffmpeg",
        [
          ...["-y", "-loglevel", "error", "-framerate", String(fps)],
          ...["-i", path.join(dir, "%04d.png")],
          ...["-c:v", "libx264", "-preset", "slow", "-crf", "10", "-tune", "animation"],
          ...["-pix_fmt", "yuv420p", video],
        ],
        { stdio: "inherit" },
      );
      videos.push(video);
      console.log(`${name} at ${zoom}×: ${video}`);
    }
  }
  if (errors.length) console.log(`Errors: ${errors.join("; ")}`);
} finally {
  await browser?.close().catch(() => {});
  await server.close().catch(() => {});
  await rm(temp, { recursive: true, force: true });
}

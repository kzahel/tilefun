// Tactical 251 evidence: where the 3D scene's top-down camera and the fixed view
// draw different pixels. An isolated Vite server, bundled Chromium and a fresh
// regional world with `?view=topdown3d`; in each of the render bench's scenes the
// game's parity probe (`canvas.__parity`) draws one moment through both
// renderers, one kind of content at a time.
//
//   node scripts/first-person/parity.mjs [--out=DIR] [--headed] [--scenes=city,woods,crowd]
//     [--zooms=1,0.25] [--query=a=b]
//   --scenes=pond compares the seeded grass/water shoreline (seed 2026).
//
// Per kind it prints the pixels each renderer draws, how much of the two
// silhouettes overlap, the whole-pixel move that aligns them best, and how far
// colours differ where both draw. Pictures of both renderers and their
// difference are written beside the JSON report.
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const option = (name, fallback) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const CAR_MODELS = [
  "vehicle-v1:compact-1",
  "vehicle-v1:beetle",
  "vehicle-v1:police-car",
  "vehicle-v1:rosso-coupe",
  "vehicle-v1:rally-hatchback",
  "vehicle-v1:tow-truck",
  "vehicle-v1:dump-truck",
  "vehicle-v1:garbage-truck-orange",
];
// The render bench's scenes (tactical 236).
const SCENES = {
  city: { arrival: [300, 519], rabbits: 0, cars: 0 },
  crowd: { arrival: [300, 519], rabbits: 1000, cars: 50 },
  woods: { arrival: [-380, -364], rabbits: 0, cars: 0 },
  pond: { arrival: [215, -196], rabbits: 0, cars: 0 },
};
const scenes = option("scenes", "city,woods,crowd").split(",");
for (const name of scenes) if (!SCENES[name]) throw Error(`Unknown scene ${name}`);
const zooms = option("zooms", "1,0.25").split(",").map(Number);
const temp = await mkdtemp(path.join(os.tmpdir(), "tilefun-parity-"));
const output = path.resolve(option("out", path.join(os.tmpdir(), "tilefun-parity")));
await mkdir(output, { recursive: true });

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
const report = { output, date: new Date().toISOString(), errors: [], cells: [] };
const percent = (share) => `${(share * 100).toFixed(1)}%`;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}/tilefun`;
  browser = await chromium.launch({
    headless: !process.argv.includes("--headed"),
    channel: "chromium",
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("pageerror", (error) => report.errors.push(error.message));
  await page.goto(`${origin}/tools.html`);
  const generation = await page.evaluate(async () => {
    const { createDescriptor } = await import("/tilefun/src/generation/GenerationDescriptor.ts");
    return createDescriptor("regional", 2026);
  });
  const query = option("query", "");
  for (const name of scenes) {
    const scene = SCENES[name];
    const arrival = { x: scene.arrival[0], y: scene.arrival[1], generation };
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
    if (scene.rabbits || scene.cars) {
      // Arrival finishes after the first ready frame; early edits are dropped.
      await page.waitForTimeout(2500);
      await page.evaluate(
        async ({ rabbits, cars, models }) => {
          const g = document.querySelector("#game").__game;
          const p = g.stateView.playerEntity.position;
          const spawns = [];
          for (let i = 0; i < cars; i++)
            spawns.push({
              entityType: models[i % models.length],
              wx: p.wx + ((i % 10) - 4.5) * 128,
              wy: p.wy - 160 - Math.floor(i / 10) * 96,
            });
          const side = Math.ceil(Math.sqrt(rabbits * 1.6));
          for (let i = 0; i < rabbits; i++)
            spawns.push({
              entityType: "wildlife-rabbit-v1",
              wx: p.wx + ((i % side) - side / 2) * 28 + 8,
              wy: p.wy + 48 + Math.floor(i / side) * 28,
            });
          g.transport.send({ type: "set-editor-mode", enabled: true });
          for (let i = 0; i < spawns.length; i += 200) {
            for (const spawn of spawns.slice(i, i + 200))
              g.transport.send({ type: "edit-spawn", ...spawn });
            await new Promise((resolve) => setTimeout(resolve, 250));
          }
          g.transport.send({ type: "set-editor-mode", enabled: false });
        },
        { rabbits: scene.rabbits, cars: scene.cars, models: CAR_MODELS },
      );
      await page.waitForTimeout(6000);
    }
    for (const zoom of zooms) {
      await page.evaluate(
        (z) => document.querySelector("#game").__game.debugPanel.setZoom(z),
        zoom,
      );
      // Ground images, chunk meshes and vehicle meshes settle.
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
        .catch(() => report.errors.push(`${name} ${zoom}: did not settle`));
      await page.waitForTimeout(2000);
      const result = await page.evaluate(() =>
        document.querySelector("#game").__parity({ pictures: true }),
      );
      const { pictures, ...numbers } = result;
      for (const [kind, url] of Object.entries(pictures ?? {}))
        await writeFile(
          path.join(output, `${name}-${zoom}-${kind}.png`),
          Buffer.from(url.slice(url.indexOf(",") + 1), "base64"),
        );
      report.cells.push({ scene: name, zoom, ...numbers });
      console.log(
        `\n${name} at ${zoom}× (${numbers.content.solids} solid props, ${numbers.content.cards} card props, ${numbers.content.entities} entities, ${numbers.content.chunks} chunks)`,
      );
      for (const [kind, f] of Object.entries(numbers.frames))
        console.log(
          `  ${kind.padEnd(9)} differing pixels ${percent(f.colour.over).padStart(6)}, mean difference ${f.colour.mean.toFixed(1)}; best move (${f.shift.x}, ${f.shift.y}) leaves ${percent(f.alignedColour.over)}`,
        );
      for (const [kind, c] of Object.entries(numbers.categories))
        console.log(
          `  ${kind.padEnd(9)} fixed ${String(c.fixed).padStart(7)} px, 3D ${String(c.scene).padStart(7)} px, overlap ${percent(c.overlap).padStart(6)}; best move (${c.shift.x}, ${c.shift.y}) gives ${percent(c.shiftedOverlap)}; where both draw ${percent(c.colour.over)} differ (mean ${c.colour.mean.toFixed(1)})`,
        );
    }
  }
  await writeFile(path.join(output, "parity.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nReport and pictures: ${output}`);
  if (report.errors.length) console.log(`Errors: ${report.errors.join("; ")}`);
} finally {
  await browser?.close().catch(() => {});
  await server.close().catch(() => {});
  await rm(temp, { recursive: true, force: true });
}

// Tactical 250 evidence: how the 3D ground's artwork pages fill in and what they
// cost. An isolated Vite server, bundled Chromium and a fresh regional world in
// first person. Reports, per view distance, the chunks drawn, the chunks wearing
// their ground page, page uploads and texture bytes; and how much the far ground
// changes between frames while the view turns very slowly (shimmer).
//
//   node scripts/first-person/ground-pages.mjs [--out=DIR] [--headed] [--query=a=b]
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const option = (name, fallback) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const temp = await mkdtemp(path.join(os.tmpdir(), "tilefun-ground-pages-"));
const output = path.resolve(option("out", path.join(temp, "captures")));
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
const report = { output, errors: [], fill: [], distances: {}, shimmer: {} };
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}/tilefun`;
  browser = await chromium.launch({
    headless: !process.argv.includes("--headed"),
    channel: "chromium",
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("pageerror", (error) => report.errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") report.errors.push(`console: ${message.text()}`);
  });
  await page.goto(`${origin}/tools.html`);
  const arrival = await page.evaluate(async () => {
    const { createDescriptor } = await import("/tilefun/src/generation/GenerationDescriptor.ts");
    return { generation: createDescriptor("regional", 2026) };
  });
  // --arrival=x,y picks the spot (tiles); the default is the render bench's city.
  const [arrivalX, arrivalY] = option("arrival", "300,519").split(",").map(Number);
  arrival.x = arrivalX;
  arrival.y = arrivalY;
  const query = option("query", "");
  await page.goto(
    `${origin}/?nogamepad&view=fps${query ? `&${query}` : ""}&generation=${encodeURIComponent(
      JSON.stringify(arrival.generation),
    )}&arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
  );
  await page.getByRole("button", { name: "New World", exact: true }).click();
  const sample = () =>
    page.evaluate(() => {
      const g = document.querySelector("#game")?.__game;
      const view = g?.firstPerson?.viewStats;
      if (!view) return null;
      const gpu = g.renderer.surface.stats;
      const terrain = g.renderer.getDiagnostics();
      return {
        chunks: view.chunks,
        groundPages: view.groundPages,
        calls: view.calls,
        fogEnd: view.fogEnd,
        uploads: gpu.uploads,
        uploadedBytes: gpu.uploadedBytes,
        pageBytes: gpu.textureBytes,
        pages: gpu.textures,
        atlasLayers: gpu.atlasLayers,
        atlasBytes: gpu.atlasBytes,
        atlasMisses: gpu.atlasMisses,
        groundImages: terrain.resident,
        groundImageBytes: terrain.surfaceBytes,
      };
    });
  // Poll until every drawn chunk has worn its page for a second (or `limit` ms).
  const settle = async (limit, trace) => {
    const started = Date.now();
    let full;
    let last = null;
    while (Date.now() - started < limit) {
      const now = await sample();
      if (now) {
        last = { ms: Date.now() - started, ...now };
        if (trace && (!trace.length || trace.at(-1).groundPages !== now.groundPages))
          trace.push({ ms: last.ms, chunks: now.chunks, groundPages: now.groundPages });
        const done = now.chunks > 0 && now.groundPages === now.chunks && now.fogEnd >= 0;
        full = done ? (full ?? Date.now()) : undefined;
        if (full && Date.now() - full > 1000) break;
      }
      await page.waitForTimeout(40);
    }
    return last;
  };
  // Arrival: from the first 3D frame until every chunk in reach wears its page.
  report.arrival = await settle(30_000, report.fill);
  const set = (code) => page.evaluate(code);
  const game = `document.querySelector("#game").__game`;
  await set(
    `(() => { const l = ${game}.firstPerson.look; l.yaw = -Math.PI / 2; l.pitch = -0.08; })()`,
  );
  for (const distance of ["near", "medium", "far"]) {
    await set(`(() => { ${game}.firstPerson.viewDistance = "${distance}"; })()`);
    // Let pages the nearer distance no longer asks for age out (120 frames).
    await page.waitForTimeout(2500);
    report.distances[distance] = await settle(30_000);
    await page.screenshot({ path: path.join(output, `ground-${distance}.png`) });
  }
  // Shimmer: turn the view about two pixels in twenty steps and add up how much
  // each pixel of the far ground band changes along the way, less its net change
  // from the first step to the last (mean per channel, 0–255). Smooth motion
  // changes a pixel in one direction; shimmer flips it back and forth.
  // Entities are frozen first (the debug panel's pause), and `still` measures the
  // same band without turning: whatever else is still changing.
  await set(`(() => { ${game}.firstPerson.viewDistance = "medium"; })()`);
  await set(`(() => { ${game}.debugPanel.pauseCheckbox.checked = true; })()`);
  await page.waitForTimeout(1500);
  for (const axis of ["still", "pitch", "yaw"]) {
    await set(
      `(() => { const l = ${game}.firstPerson.look; l.yaw = -Math.PI / 2; l.pitch = -0.08; })()`,
    );
    await page.waitForTimeout(300);
    const frames = [];
    for (let step = 0; step < 21; step++) {
      if (axis !== "still") await set(`(() => { ${game}.firstPerson.look.${axis} += 0.0002; })()`);
      await page.waitForTimeout(120);
      frames.push(
        await page.evaluate(() => {
          const world = document.querySelector("canvas[data-renderer=gpu]:not(#game)");
          const copy = document.createElement("canvas");
          copy.width = world.width;
          copy.height = 110;
          const ctx = copy.getContext("2d", { willReadFrequently: true });
          // The band from just under the horizon to the middle distance.
          ctx.drawImage(world, 0, 365, world.width, 110, 0, 0, world.width, 110);
          return Array.from(ctx.getImageData(0, 0, copy.width, copy.height).data);
        }),
      );
    }
    const first = frames[0],
      last = frames.at(-1);
    let excess = 0;
    let count = 0;
    for (let p = 0; p < first.length; p += 4)
      for (let c = 0; c < 3; c++) {
        let travelled = 0;
        for (let i = 1; i < frames.length; i++)
          travelled += Math.abs(frames[i][p + c] - frames[i - 1][p + c]);
        excess += travelled - Math.abs(last[p + c] - first[p + c]);
        count++;
      }
    report.shimmer[axis] = Math.round((excess / count) * 1000) / 1000;
  }
  await page.screenshot({ path: path.join(output, "ground-after-turns.png") });
} catch (error) {
  report.errors.push(String(error?.stack ?? error));
} finally {
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser?.close();
  await server.close();
  await rm(temp, { recursive: true, force: true });
}
if (report.errors.length) process.exitCode = 1;

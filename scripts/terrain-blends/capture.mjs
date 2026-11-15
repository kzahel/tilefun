// Isolated hardware-GPU capture and UI/renderer boundary checks for the terrain lab.
// node scripts/terrain-blends/capture.mjs [--out=/tmp/tilefun-terrain-blends] [--headed]
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const temp = await mkdtemp(path.join(os.tmpdir(), "tilefun-blend-lab-"));
const output = path.resolve(
  process.argv.find((a) => a.startsWith("--out="))?.slice(6) ??
    path.join(os.tmpdir(), "tilefun-terrain-blends"),
);
await mkdir(output, { recursive: true });
const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  cacheDir: path.join(temp, "vite-cache"),
  plugins: [react()],
  optimizeDeps: { entries: ["workshop.html"] },
  server: { host: "127.0.0.1", port: 0, hmr: false, watch: null },
  logLevel: "error",
});
let browser;
const report = { errors: [], captures: [], checks: [] };
try {
  await server.listen();
  browser = await chromium.launch({
    channel: "chromium",
    headless: !process.argv.includes("--headed"),
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.on("pageerror", (e) => report.errors.push(e.message));
  const url = `http://127.0.0.1:${server.httpServer.address().port}/tilefun/workshop.html#/tool/terrain-blends`;
  await page.goto(url);
  await page.locator('[data-terrain-study-ready="true"]').waitFor({ timeout: 60_000 });
  const choose = async (id) => {
    await page.getByLabel("Example", { exact: true }).selectOption(id);
    await page.waitForFunction((expected) => {
      const canvas = document.querySelector('canvas[aria-label="Game terrain artwork"]');
      return (
        location.hash.includes(`case=${expected}`) &&
        canvas?.width === (expected === "pond" ? 512 : 384)
      );
    }, id);
  };
  for (const id of ["pond", "thin-bands", "wide-bands", "junction"]) {
    await choose(id);
    await page.locator(".terrain-blend-maps").screenshot({ path: path.join(output, `${id}.png`) });
    report.captures.push(id);
  }
  // A three-way join exercises two opaque pair layers. The final inspector crop
  // must equal the game's corresponding GPU tile, with the existing 2-channel tolerance.
  await page.getByLabel("Tile X", { exact: true }).selectOption("11");
  await page.getByLabel("Tile Y", { exact: true }).selectOption("11");
  const cropDifference = await page.evaluate(() => {
    const gpu = document.querySelector('canvas[aria-label="Game terrain artwork"]');
    const composed = [...document.querySelectorAll('canvas[aria-label="Composed tile"]')].at(-1);
    const copy = document.createElement("canvas");
    copy.width = copy.height = 16;
    const ctx = copy.getContext("2d");
    ctx.drawImage(gpu, 11 * 16, 11 * 16, 16, 16, 0, 0, 16, 16);
    const actual = ctx.getImageData(0, 0, 16, 16).data;
    const expected = composed.getContext("2d").getImageData(0, 0, 16, 16).data;
    return actual.reduce((max, value, i) => Math.max(max, Math.abs(value - expected[i])), 0);
  });
  assert.ok(cropDifference <= 2, `Inspector disagrees with GPU by ${cropDifference}`);
  report.checks.push({ inspectorGpuMaxChannelDifference: cropDifference });
  await choose("paint");
  const samples = page.getByLabel("Material samples", { exact: true });
  const withBridges = await samples.evaluate((c) => c.toDataURL());
  await page.getByLabel("Editor bridges", { exact: true }).selectOption("0");
  const withoutBridges = await samples.evaluate((c) => c.toDataURL());
  assert.notEqual(withBridges, withoutBridges, "Bridge control must change actual sample data");
  report.checks.push("editor bridges change samples");
  await page.setViewportSize({ width: 390, height: 844 });
  await choose("pond");
  await samples.click({ position: { x: 24, y: 24 } });
  const bounds = await samples.boundingBox();
  assert.equal(
    await page.getByLabel("Tile X", { exact: true }).inputValue(),
    String(Math.floor((24 / bounds.width) * 32)),
  );
  assert.equal(
    await page.getByLabel("Tile Y", { exact: true }).inputValue(),
    String(Math.floor((24 / bounds.height) * 32)),
  );
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "Mobile page must not overflow horizontally",
  );
  await page.screenshot({ path: path.join(output, "mobile.png"), fullPage: true });
  report.checks.push("mobile map selection and layout");
  assert.deepEqual(report.errors, []);
} finally {
  await writeFile(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser?.close();
  await server.close();
  await rm(temp, { recursive: true, force: true });
  console.log(JSON.stringify({ output, ...report }, null, 2));
}

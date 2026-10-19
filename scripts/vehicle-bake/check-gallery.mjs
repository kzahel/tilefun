/** Public collection navigation at native pixels, using bundled full Chromium. */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const output = resolve("data/vehicle-bake/gallery-check");
await mkdir(output, { recursive: true });
const manifest = JSON.parse(await readFile("public/demos/original-vehicles/manifest.json", "utf8"));
const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  cacheDir: resolve(output, "vite-cache"),
  logLevel: "error",
  server: { port: 0, host: "127.0.0.1", watch: null },
  optimizeDeps: { entries: [] },
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({ channel: "chromium", headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const address = server.httpServer.address();
  const url = `http://127.0.0.1:${address.port}/tilefun/demos/original-vehicles/index.html`;
  const dimensions = [];
  for (const viewport of [
    { width: 1200, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(url);
    await page.waitForFunction(
      (count) => document.querySelectorAll("a.vehicle").length === count,
      manifest.candidates.length,
    );
    await page.locator(".preview img").evaluateAll(async (images) => {
      await Promise.all(
        images.map((image) => {
          image.loading = "eager";
          return image.decode();
        }),
      );
    });
    const frames = await page.locator(".preview img").evaluateAll((images) =>
      images.map((image) => ({
        native: image.naturalWidth,
        displayed: image.getBoundingClientRect().width,
      })),
    );
    for (const frame of frames) {
      assert.ok(frame.native >= 128);
      assert.equal(frame.displayed, frame.native, "Gallery must preserve native pixels");
    }
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    await page.screenshot({
      path: resolve(output, `gallery-${viewport.width}.png`),
      fullPage: true,
    });
    dimensions.push({ viewport, frames });
  }
  for (const candidate of manifest.candidates) {
    await page.goto(url);
    await page.getByRole("link", { name: `Inspect ${candidate.name}`, exact: true }).click();
    await page.waitForFunction(() => window.familyReviewReady === true);
    assert.ok(page.url().endsWith(`/tilefun/${candidate.url}`));
    assert.equal(
      await page.evaluate(() => window.familyReview.state.stats.triangles),
      candidate.audit.triangles,
    );
  }
  assert.deepEqual(errors, []);
  const result = { status: "passed", vehicles: manifest.candidates.length, dimensions, errors };
  await writeFile(resolve(output, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser?.close();
  await server.close();
}

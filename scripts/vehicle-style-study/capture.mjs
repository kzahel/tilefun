/** Isolated gallery capture with bundled full Chromium; no owner browser or feedback writes. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const output = resolve(process.argv[2] ?? "data/vehicle-style-study/gallery-check");
await mkdir(output, { recursive: true });
const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  cacheDir: resolve(output, "vite-cache"),
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0, watch: null },
  optimizeDeps: { entries: [] },
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({ channel: "chromium", headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  const address = server.httpServer.address();
  await page.goto(`http://127.0.0.1:${address.port}/tilefun/demos/vehicle-style-study/index.html`);
  await page.waitForFunction(() => window.vehicleStyleStudyReady === true);
  assert.equal(await page.locator(".route").count(), 4);
  async function imagesReady() {
    await page.waitForFunction(() =>
      [...document.images].every((img) => img.complete && img.naturalWidth > 0),
    );
  }
  await imagesReady();
  await page.screenshot({ path: resolve(output, "desktop.png"), fullPage: true });
  await page.locator("#scale").selectOption("1");
  for (let angle = 0; angle < 8; angle++) {
    await page.locator("#angle").evaluate((input, value) => {
      input.value = String(value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, angle);
    await imagesReady();
    assert.equal(await page.locator(`.car[src$="view-${angle}.png"]`).count(), 4);
  }
  await page.screenshot({ path: resolve(output, "native.png"), fullPage: true });
  await page.locator("#stage").selectOption("raw");
  await imagesReady();
  assert.equal(await page.locator(".car.raw").count(), 4);
  await page.locator("#play").click();
  await page.waitForFunction(() => document.querySelector("#angle").value !== "7");
  await page.locator("#play").click();
  assert.equal(await page.locator("#play").getAttribute("aria-pressed"), "false");
  await page.locator("#stage").selectOption("view");
  await page.locator("#scale").selectOption("2");
  await page.setViewportSize({ width: 390, height: 844 });
  await imagesReady();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: resolve(output, "mobile.png"), fullPage: true });
  assert.deepEqual(errors, []);
  await page.goto(pathToFileURL(resolve("data/vehicle-style-study/standalone.html")).href);
  await page.waitForFunction(() => window.vehicleStyleStudyReady === true);
  await imagesReady();
  assert.equal(await page.locator(".route").count(), 4);
  assert.equal(await page.locator('.car[src^="data:image/png;base64,"]').count(), 4);
  await page.locator("#stage").selectOption("raw");
  await imagesReady();
  assert.deepEqual(errors, []);
  await writeFile(
    resolve(output, "result.json"),
    JSON.stringify(
      {
        status: "passed",
        routes: 4,
        headings: 8,
        checked: [
          "artifact loading",
          "native scale",
          "direction synchronization",
          "raw render switch",
          "play/pause",
          "mobile overflow",
          "standalone file without a server",
        ],
        errors,
      },
      null,
      2,
    ),
  );
  console.log(`Gallery checks passed. Captures: ${output}`);
} finally {
  await browser?.close();
  await server.close();
}

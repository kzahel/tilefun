/** Desktop/mobile and genuinely network-free offline paint-gallery controls. */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const root = resolve("public");
const directory = resolve(root, "demos/original-vehicles/paint-study-v1");
const qa = resolve("data/vehicle-bake/paint-study-v1");
const study = JSON.parse(await readFile(resolve(directory, "study.json"), "utf8"));
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, "http://localhost").pathname;
    assert.ok(pathname.startsWith("/tilefun/"));
    const file = resolve(root, decodeURIComponent(pathname.slice(9)));
    assert.ok(file.startsWith(root + sep));
    response.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".png": "image/png",
        ".json": "application/json",
      }[extname(file)] ?? "application/octet-stream",
    );
    response.end(await readFile(file));
  } catch {
    response.statusCode = 404;
    response.end();
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
let browser;
try {
  browser = await chromium.launch({ channel: "chromium", headless: true });
  const errors = [];
  const check = async (page) => {
    page.on("pageerror", (error) => errors.push(error.message));
    await page.waitForFunction(() => window.paintStudyReady === true);
    for (const viewport of [
      { width: 1200, height: 1050 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      for (const row of study.candidates) {
        await page.locator("#paint").selectOption(row.id);
        for (const mode of ["engine", "study"]) {
          await page.locator("#camera").selectOption(mode);
          for (const heading of ["0", "2", "7", "15"]) {
            await page.locator("#heading").fill(heading);
            await page.waitForFunction(() => {
              const image = document.querySelector("#selected-frame");
              return image.complete && image.naturalWidth > 0;
            });
          }
        }
        for (const zoom of ["1", "2", "3"]) {
          await page.locator("#scale").selectOption(zoom);
          assert.equal(
            await page
              .locator("#selected-frame")
              .evaluate((image) => image.getBoundingClientRect().width),
            row.nativeSize * Number(zoom),
          );
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            true,
            `${row.id}/${zoom} mobile overflow`,
          );
        }
        for (const color of ["grass", "road", "neutral"])
          await page.locator("#background").selectOption(color);
      }
      await page.locator(`.paint-card[data-id="${study.candidates.at(-1).id}"]`).click();
      assert.equal(await page.locator("#paint").inputValue(), study.candidates.at(-1).id);
    }
  };
  const page = await browser.newPage();
  await page.goto(
    `http://127.0.0.1:${server.address().port}/tilefun/demos/original-vehicles/paint-study-v1/index.html`,
  );
  await check(page);
  await page.locator("#paint").selectOption("paint-rosso-coupe-navy-stripes-v1");
  await page.locator("#camera").selectOption("study");
  await page.locator("#heading").fill("2");
  await page.locator("#scale").selectOption("2");
  await page.setViewportSize({ width: 1200, height: 1050 });
  await page.screenshot({ path: resolve(qa, "desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: resolve(qa, "mobile.png"), fullPage: true });
  const offline = await browser.newPage();
  const offlineRequests = [];
  offline.on("request", (request) => {
    if (/^https?:/.test(request.url())) offlineRequests.push(request.url());
  });
  await offline.goto(pathToFileURL(resolve(qa, "index.html")).href);
  await check(offline);
  assert.deepEqual(offlineRequests, []);
  assert.deepEqual(errors, []);
  const proof = {
    status: "passed",
    variants: 14,
    browser: browser.version(),
    channel: "bundled full Chromium",
    desktop: [1200, 1050],
    mobile: [390, 844],
    cameras: 2,
    headingsPerCamera: [0, 45, 157.5, 337.5],
    scales: [1, 2, 3],
    backgrounds: ["neutral", "grass", "road"],
    noPageOverflow: true,
    offlineNetworkRequests: offlineRequests,
    errors,
  };
  await writeFile(resolve(qa, "gallery-qa.json"), `${JSON.stringify(proof, null, 2)}\n`);
  console.log("All 14 paint schemes: desktop/mobile/offline gallery controls passed");
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve } from "node:path";
import { chromium } from "@playwright/test";

const species = process.argv[2];
assert(["horse", "giraffe"].includes(species));
const base = `public/demos/wildlife-v2/${species}/motion-v2`;
const output = `data/long-legged-139/${species}/browser`;
await mkdir(output, { recursive: true });
const publicRoot = resolve("public");
const server = createServer(async (req, res) => {
  try {
    const path = resolve(
      publicRoot,
      decodeURIComponent(new URL(req.url, "http://localhost").pathname).replace(/^\/tilefun\//, ""),
    );
    assert(path.startsWith(`${publicRoot}\\`) || path.startsWith(`${publicRoot}/`));
    const types = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".json": "application/json",
      ".png": "image/png",
      ".gif": "image/gif",
    };
    res.setHeader("Content-Type", types[extname(path)] || "application/octet-stream");
    res.end(await readFile(path));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
let browser;
try {
  browser = await chromium.launch({ channel: "chromium", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto(
    `http://127.0.0.1:${server.address().port}/tilefun/demos/wildlife-v2/${species}/motion-v2/index.html`,
  );
  await page.waitForFunction(() => window.longLeggedMotion?.ready);
  const results = [];
  for (const scale of [1, 3]) {
    results.push(
      await page.evaluate(async (scale) => {
        const metadata = await (await fetch("sprite.json")).json();
        const image = new Image();
        image.src = "sheet.png";
        await image.decode();
        const canvas = document.querySelector("canvas");
        canvas.style.width = `${canvas.width * scale}px`;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        const expected = document.createElement("canvas");
        const size = metadata.frameWidth;
        expected.width = expected.height = size;
        const ec = expected.getContext("2d", { willReadFrequently: true });
        let chronologicalPoses = 0,
          exactFacingCrops = 0;
        for (const [clip, def] of Object.entries(metadata.clips)) {
          for (let i = 0; i < def.count; i++) {
            window.longLeggedMotion.inspect(clip, i);
            for (let row = 0; row < 4; row++) {
              ec.clearRect(0, 0, size, size);
              ec.drawImage(image, (def.start + i) * size, row * size, size, size, 0, 0, size, size);
              const a = ec.getImageData(0, 0, size, size).data;
              const b = ctx.getImageData(row * size, 0, size, size).data;
              if (!a.every((v, n) => v === b[n])) throw Error(`Crop mismatch ${clip}/${i}/${row}`);
              exactFacingCrops++;
            }
            chronologicalPoses++;
          }
        }
        window.longLeggedMotion.inspect("walk", 8);
        return { scale, chronologicalPoses, exactFacingCrops };
      }, scale),
    );
    await page.screenshot({ path: `${output}/scale-${scale}.png`, fullPage: true });
  }
  await page.locator("#step").click();
  assert.equal(await page.locator("#pose").inputValue(), "9");
  await page.locator("#pose").focus();
  await page.locator("#pose").press("End");
  assert.equal(await page.locator("#pose").inputValue(), "31");
  await page.locator("#speed").selectOption("0.5");
  await page.locator("#pause").click();
  await page.waitForFunction(() => document.querySelector("canvas").dataset.pose !== "31");
  await page.locator("#pause").click();
  assert.deepEqual(errors, []);
  const validation = {
    identity: `${species}-motion-v2`,
    browser: "bundled full Chromium",
    results,
    controls: "pause/play, next, range keyboard scrubbing and speed",
    errors,
  };
  await writeFile(`${base}/validation.json`, `${JSON.stringify(validation, null, 2)}\n`);
  console.log(JSON.stringify(validation));
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}

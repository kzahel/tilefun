import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve } from "node:path";
import { chromium } from "@playwright/test";

const output = "data/horse-motion-139/browser";
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
      ".webp": "image/webp",
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
    viewport: { width: 1100, height: 1000 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto(
    `http://127.0.0.1:${server.address().port}/tilefun/demos/wildlife-v2/horse/motion-study-v1/index.html`,
  );
  await page.waitForFunction(() => window.horseMotionStudy?.ready);
  const result = await page.evaluate(async () => {
    const load = async (url) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      return image;
    };
    const [side, travel, sheet] = await Promise.all(
      ["side-frames.webp", "travel-frames.webp", "sheet.png"].map(load),
    );
    const expected = document.createElement("canvas");
    const ec = expected.getContext("2d", { willReadFrequently: true });
    const canvas = document.querySelector("#study");
    const native = document.querySelector("#native");
    let chronologicalPoses = 0,
      exactNativeCrops = 0;
    const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
    for (const [mode, image, count, width] of [
      ["side", side, 32, 640],
      ["travel", travel, 64, 960],
    ]) {
      for (let pose = 0; pose < count; pose++) {
        window.horseMotionStudy.inspect(pose, mode);
        expected.width = width;
        expected.height = 580;
        ec.drawImage(
          image,
          (pose % 8) * width,
          Math.floor(pose / 8) * 580,
          width,
          580,
          0,
          0,
          width,
          580,
        );
        if (
          !same(
            ec.getImageData(0, 0, width, 580).data,
            canvas.getContext("2d").getImageData(0, 0, width, 580).data,
          )
        )
          throw Error(`Wrong ${mode} pose ${pose}`);
        for (let row = 0; row < 4; row++) {
          expected.width = expected.height = 80;
          ec.drawImage(sheet, (pose % 32) * 80, row * 80, 80, 80, 0, 0, 80, 80);
          if (
            !same(
              ec.getImageData(0, 0, 80, 80).data,
              native.getContext("2d").getImageData(row * 80, 0, 80, 80).data,
            )
          )
            throw Error(`Native crop mismatch ${pose}/${row}`);
          exactNativeCrops++;
        }
        chronologicalPoses++;
      }
    }
    window.horseMotionStudy.inspect(0);
    return { chronologicalPoses, exactNativeCrops };
  });
  await page.locator("#step").click();
  assert.equal(await page.locator("#pose").inputValue(), "1");
  await page.locator("#view").selectOption("travel");
  assert.equal(await page.locator("#pose").getAttribute("max"), "63");
  await page.locator("#pause").click();
  await page.waitForFunction(() => Number(document.querySelector("#pose").value) > 1);
  await page.locator("#pause").click();
  await page.locator("#pose").focus();
  await page.locator("#pose").press("End");
  assert.equal(await page.locator("#pose").inputValue(), "63");
  assert.equal(await page.locator("#status").textContent(), "64 / 64");
  await page.locator("#speed").selectOption("1");
  assert.equal(await page.locator("#speed").inputValue(), "1");
  await page.locator("#speed").selectOption("0.5");
  await page.evaluate(() => window.horseMotionStudy.inspect(8));
  await page.screenshot({ path: `${output}/side.png`, fullPage: true });
  await page.evaluate(() => window.horseMotionStudy.inspect(40, "travel"));
  await page.screenshot({ path: `${output}/travel.png`, fullPage: true });
  assert.deepEqual(errors, []);
  const validation = {
    identity: "horse-motion-study-v1",
    browser: "bundled full Chromium",
    ...result,
    controls: "pause/play, step, view, range keyboard scrubbing and speed selection validated",
    errors,
  };
  await writeFile(
    "public/demos/wildlife-v2/horse/motion-study-v1/validation.json",
    `${JSON.stringify(validation, null, 2)}\n`,
  );
  console.log(JSON.stringify(validation));
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}

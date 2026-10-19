/** Compare new harness against all frozen Beetle pixels and viewport crop invariance. */
import assert from "node:assert/strict";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import { build, createServer } from "vite";

const qa = resolve(process.argv[2] ?? "data/vehicle-bake/school-bus-qa");
const out = resolve(qa, "beetle-regression");
await mkdir(out, { recursive: true });
await cp("public/demos/original-vehicles/beetle-v1", out, { recursive: true });
await rm(resolve(out, "review-manifest.json"), { force: true });
await cp("scripts/vehicle-bake/family-review.html", resolve(out, "index.html"));
await cp("scripts/vehicle-bake/family-review.css", resolve(out, "review.css"));
await build({
  configFile: false,
  logLevel: "error",
  publicDir: false,
  build: {
    outDir: out,
    emptyOutDir: false,
    lib: {
      entry: resolve("scripts/vehicle-bake/family-viewer.mjs"),
      name: "FamilyRegression",
      formats: ["iife"],
      fileName: () => "viewer.js",
    },
    minify: true,
  },
});
const server = await createServer({
  configFile: false,
  base: "/",
  logLevel: "error",
  cacheDir: resolve(qa, "regression-vite"),
  server: { host: "127.0.0.1", port: 0, watch: null },
  optimizeDeps: { entries: [] },
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({ channel: "chromium", headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(
    `http://127.0.0.1:${server.httpServer.address().port}/${out.slice(resolve(".").length + 1).replaceAll("\\", "/")}/index.html`,
  );
  await page.waitForFunction(() => window.familyReviewReady);
  const results = [];
  for (const mode of ["study", "engine"])
    for (let index = 0; index < 16; index++) {
      const pixels = await page.evaluate(
        ({ mode, index }) => {
          window.familyReview.setNativeSize(128);
          const small = window.familyReview.pose(index * 22.5, 0, mode).pixels;
          window.familyReview.setNativeSize(224);
          const large = window.familyReview.pose(index * 22.5, 0, mode).pixels;
          return { small, large };
        },
        { mode, index },
      );
      const frozen = PNG.sync.read(
        await readFile(`public/demos/original-vehicles/beetle-v1/captures/${mode}-${index}.png`),
      );
      assert.deepEqual(Buffer.from(pixels.small), frozen.data, `Frozen Beetle ${mode}/${index}`);
      const crop = Buffer.alloc(128 * 128 * 4);
      for (let y = 0; y < 128; y++)
        Buffer.from(pixels.large).copy(
          crop,
          y * 128 * 4,
          ((y + 48) * 224 + 48) * 4,
          ((y + 48) * 224 + 176) * 4,
        );
      assert.deepEqual(crop, frozen.data, `224 centered crop including outline ${mode}/${index}`);
      results.push({ mode, yaw: index * 22.5, frozen128Exact: true, centered224CropExact: true });
    }
  assert.deepEqual(errors, []);
  await writeFile(
    resolve(qa, "pixel-regression.json"),
    `${JSON.stringify({ status: "passed", browser: browser.version(), views: results, all32FrozenFramesExact: true, all32LargerViewportCropsExact: true }, null, 2)}\n`,
  );
  console.log(
    "PASS: all 32 frozen 128px Beetle captures and all 32 centered 224px crops are byte-exact RGBA, including shared outline.",
  );
} finally {
  await browser?.close();
  await server.close();
}

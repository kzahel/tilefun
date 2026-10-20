/** Prove runtime external atlases equal all reviewed pixels, without new meshes. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import { build } from "vite";

const qa = resolve("data/vehicle-bake/paint-runtime-qa");
const publicRoot = resolve("public");
await mkdir(qa, { recursive: true });
const study = JSON.parse(
  await readFile("public/demos/original-vehicles/paint-study-v1/study.json", "utf8"),
);
const sourceConfig = JSON.parse(
  await readFile("scripts/vehicle-bake/paint-variants-v1.json", "utf8"),
);
const paints = JSON.parse(await readFile("src/traffic/vehicle-paints-v1.json", "utf8"));
await build({
  configFile: false,
  base: "/tilefun/",
  publicDir: false,
  logLevel: "error",
  build: {
    outDir: qa,
    emptyOutDir: false,
    lib: {
      entry: resolve("scripts/vehicle-bake/paint-runtime-parity-entry.mjs"),
      name: "PaintRuntimeQA",
      formats: ["iife"],
      fileName: () => "viewer.js",
    },
    minify: true,
  },
});
await copyFile("scripts/vehicle-bake/family-review.html", resolve(qa, "index.html"));
await copyFile("scripts/vehicle-bake/family-review.css", resolve(qa, "review.css"));
const first = study.candidates[0];
const candidateFor = (row) => ({
  id: row.id,
  name: row.name,
  nativeSize: row.nativeSize,
  glb: `/tilefun/${sourceConfig.families[row.family].glb.replace(/^public\//, "")}`,
  atlas: `/tilefun/${paints.families[row.family].schemes.find((p) => p.id === row.scheme.id).atlas}`,
  report: `/tilefun/demos/original-vehicles/paint-study-v1/${row.id}/report.json`,
});
await writeFile(
  resolve(qa, "candidate.json"),
  JSON.stringify({ version: 1, candidates: [candidateFor(first)] }),
);
const server = createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const prefix = "/tilefun/_paint-runtime-qa/";
    assert.ok(path.startsWith("/tilefun/"));
    const base = path.startsWith(prefix) ? qa : publicRoot;
    const file = resolve(base, path.slice(path.startsWith(prefix) ? prefix.length : 9));
    assert.ok(file.startsWith(base + sep));
    response.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".glb": "model/gltf-binary",
        ".png": "image/png",
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
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/tilefun/_paint-runtime-qa/index.html`);
  await page.waitForFunction(() => window.familyReviewReady && window.runtimePaintResources);
  let family;
  const results = [];
  for (const row of study.candidates) {
    if (family !== row.family) {
      await page.evaluate(async (candidate) => {
        await window.familyReview.load(candidate);
      }, candidateFor(row));
      family = row.family;
    }
    const paint = paints.families[row.family].schemes.find((p) => p.id === row.scheme.id);
    await page.evaluate((paint) => window.runtimePaintResources.request(paint), paint);
    await page.waitForFunction(
      (path) => window.runtimePaintResources.states[path]?.state === "ready",
      paint.atlas,
    );
    const original = await page.evaluate(() => {
      const uuids = [];
      window.familyReview.state.asset.object.traverse((n) => {
        if (n.isMesh) uuids.push([n.uuid, n.geometry.uuid, n.material.uuid]);
      });
      return uuids;
    });
    await page.evaluate((paint) => {
      const cache = window.runtimePaintResources;
      cache.beginFrame();
      const texture = cache.request(paint);
      if (!texture) throw Error("Paint not published at frame boundary");
      window.resetRuntimePaint = cache.bind(window.familyReview.state.asset.object, texture);
    }, paint);
    const radius = (await page.evaluate(() => window.familyReview.wheelRadii()))[0].radius;
    const checks = [];
    for (const mode of ["study", "engine"]) {
      for (let i = 0; i < 24; i++) {
        const heading = i < 16 ? i * 22.5 : 45;
        const phase = i < 16 ? 0 : i - 16 < 4 ? i - 16 : i - 24;
        const distance = (radius * Math.PI * phase) / 4;
        const rendered = await page.evaluate(
          ({ heading, distance, mode }) => window.familyReview.pose(heading, distance, mode).pixels,
          { heading, distance, mode },
        );
        const name = i < 16 ? `${mode}-${i}` : `${mode}-roll-${i - 16}`;
        const expected = PNG.sync.read(
          await readFile(
            resolve(
              publicRoot,
              `demos/original-vehicles/paint-study-v1/${row.id}/captures/${name}.png`,
            ),
          ),
        );
        assert.equal(
          Buffer.compare(Buffer.from(rendered), expected.data),
          0,
          `${row.id}/${name}: runtime atlas changed reviewed pixels`,
        );
        checks.push(name);
        if (i === 2) {
          const png = new PNG({ width: row.nativeSize, height: row.nativeSize });
          png.data = Buffer.from(rendered);
          await writeFile(resolve(qa, `${row.id}-${mode}.png`), PNG.sync.write(png));
        }
      }
    }
    const current = await page.evaluate(() => {
      const uuids = [];
      window.familyReview.state.asset.object.traverse((n) => {
        if (n.isMesh) uuids.push([n.uuid, n.geometry.uuid, n.material.uuid]);
      });
      window.resetRuntimePaint();
      return uuids;
    });
    assert.deepEqual(current, original);
    const reset = await page.evaluate(() => window.familyReview.pose(45, 0, "engine").pixels);
    const baseline = PNG.sync.read(
      await readFile(
        resolve(
          publicRoot,
          `demos/original-vehicles/paint-study-v1/base-${row.family}/captures/engine-2.png`,
        ),
      ),
    );
    assert.equal(
      Buffer.compare(Buffer.from(reset), baseline.data),
      0,
      "Shared asset failed to restore original paint",
    );
    const glb = await readFile(sourceConfig.families[row.family].glb);
    results.push({
      model: row.family,
      paint: paint.id,
      status: "passed",
      frames: checks.length,
      baseGlbSha256: createHash("sha256").update(glb).digest("hex"),
      identicalReviewedRGBA: true,
      sameMeshGeometryAndMaterialObjects: true,
      originalResetExact: true,
    });
    console.log(
      `${row.family}/${paint.id}: ${checks.length} reviewed frames exact; same geometry/materials; original reset exact`,
    );
  }
  assert.deepEqual(errors, []);
  const receipt = {
    status: "passed",
    browser: browser.version(),
    channel: "bundled full Chromium",
    runtimeModelsLoaded: 3,
    schemeTextures: 14,
    results,
    errors,
  };
  await writeFile(resolve(qa, "parity.json"), `${JSON.stringify(receipt, null, 2)}\n`);
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}

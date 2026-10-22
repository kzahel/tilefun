// Pixel qualification only; no gameplay or performance policy changes.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";
import { build } from "vite";

const root = path.resolve(import.meta.dirname, "../..");
const endpoint = process.argv.find((arg) => arg.startsWith("--cdp="))?.slice(6) ?? "";
const port = Number(process.argv.find((arg) => arg.startsWith("--port="))?.slice(7) ?? 0);
if (endpoint && !port)
  throw Error("Physical pixel probes require an owned --port and USB reverse route");
const cacheProbe = process.argv.includes("--probe=cache");
const batchProbe = process.argv.includes("--probe=batch");
const surfaceProbe = process.argv.includes("--probe=surface");
const entry = surfaceProbe
  ? "surface-overlay-entry.mjs"
  : batchProbe
    ? "ordered-texture-batch-entry.mjs"
    : cacheProbe
      ? "car-body-cache-entry.mjs"
      : "fused-outline-composite-entry.mjs";
const output = path.resolve(
  process.argv.find((arg) => arg.startsWith("--output="))?.slice(9) ??
    path.join(os.tmpdir(), "tilefun-fused-outline-composite"),
);
await mkdir(output, { recursive: true });
await build({
  root,
  configFile: false,
  publicDir: false,
  logLevel: "error",
  build: {
    outDir: output,
    emptyOutDir: false,
    minify: false,
    lib: {
      entry: path.join(root, "scripts/instrumentation", entry),
      name: "OutlineProbe",
      formats: ["iife"],
      fileName: () => "probe.js",
    },
  },
});
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://localhost");
    if (url.pathname === "/") {
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end(
        '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><canvas width="512" height="512"></canvas><script src="/probe.js"></script>',
      );
      return;
    }
    const file =
      url.pathname === "/probe.js"
        ? path.join(output, "probe.js")
        : /^\/assets\/(?:models\/vehicles|vehicles)\/[\w/-]+\.(?:glb|png)$/.test(url.pathname)
          ? path.join(root, "public", url.pathname)
          : null;
    if (!file) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.setHeader(
      "Content-Type",
      file.endsWith(".js")
        ? "text/javascript; charset=utf-8"
        : file.endsWith(".png")
          ? "image/png"
          : "model/gltf-binary",
    );
    response.end(await readFile(file));
  } catch (error) {
    response.writeHead(500);
    response.end(String(error));
  }
});
await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
let browser, page;
try {
  browser = endpoint
    ? await chromium.connectOverCDP(endpoint, { noDefaults: true })
    : await chromium.launch({ channel: "chromium", headless: true });
  page = endpoint ? await browser.contexts()[0].newPage() : await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => window.run);
  const result = await page.evaluate(() => window.run());
  const preview = result.preview;
  delete result.preview;
  result.browser = browser.version();
  result.physical = !!endpoint;
  result.errors = errors;
  const paths = [
    "scripts/instrumentation/fused-outline-composite.mjs",
    `scripts/instrumentation/${entry}`,
    "src/rendering/GpuMeshBodies.ts",
    "src/rendering/CarBodyImageCache.ts",
    "src/rendering/GpuRasterSurface.ts",
    "src/rendering/GpuOverlayResources.ts",
    "src/rendering/GpuRenderBackend.ts",
    "src/rendering/presentSurfaceScene.ts",
    "src/rendering/CarPixelOutline.ts",
    "src/rendering/CarMeshProjection.ts",
    "src/rendering/CarMeshAsset.ts",
    "src/rendering/AuthoredVehicleMeshes.ts",
    ...result.rows.map((row) => `public/${row.path}`),
  ];
  result.hashes = Object.fromEntries(
    await Promise.all(
      paths.map(async (file) => [
        file,
        createHash("sha256")
          .update(await readFile(path.join(root, file)))
          .digest("hex"),
      ]),
    ),
  );
  await writeFile(path.join(output, "report.json"), `${JSON.stringify(result, null, 2)}\n`);
  await writeFile(path.join(output, "preview.png"), Buffer.from(preview.split(",")[1], "base64"));
  console.log(JSON.stringify(result));
  assert.deepEqual(errors, []);
  if (surfaceProbe) {
    assert.ok(result.pairs >= 12);
    assert.ok(result.reused > 0);
    assert.ok(result.culled > 0);
    assert.ok(result.bounded);
    assert.ok(result.legacyMaxChannelError <= 2);
  } else assert.equal(result.pairs, batchProbe ? 18 : cacheProbe ? 144 : 72);
  if (cacheProbe) {
    assert.equal(result.cachedRenderCalls, 0);
    assert.equal(result.bypassVerified, 3);
    assert.equal(result.deferredEvictionVerified, true);
    assert.equal(result.disableDrainVerified, true);
  }
  if (batchProbe)
    for (const row of result.comparisons) {
      if (row.name === "capacity and partial final batch") assert.equal(row.batchedDraws, 3);
      if (row.name === "reused three sources") assert.equal(row.batchedDraws, 1);
    }
  assert.equal(result.totalMismatchingPixels, 0);
  assert.equal(result.maxChannelError, 0);
} finally {
  await page?.close();
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}

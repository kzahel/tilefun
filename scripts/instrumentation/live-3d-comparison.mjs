/** Bounded GPU depth experiment; no game changes or generated production assets. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve, sep } from "node:path";
import { chromium } from "@playwright/test";
import { build } from "vite";

const root = resolve(".");
const sourceRoot = resolve(
  process.argv.find((arg) => arg.startsWith("--source-root="))?.slice(14) ??
    "data/3d-investigation/export-trial-final",
);
assert.ok(sourceRoot.startsWith(resolve("data") + sep));
const qa = resolve(
  process.argv.find((arg) => arg.startsWith("--output="))?.slice(9) ??
    "data/3d-investigation/comparison",
);
assert.ok(qa.startsWith(resolve("data") + sep));
await mkdir(qa, { recursive: true });
await build({
  configFile: false,
  publicDir: false,
  logLevel: "error",
  build: {
    outDir: qa,
    emptyOutDir: false,
    minify: true,
    lib: {
      entry: resolve("scripts/instrumentation/live-3d-comparison-entry.mjs"),
      name: "Live3dComparison",
      formats: ["iife"],
      fileName: () => "comparison.js",
    },
  },
});
const html =
  '<!doctype html><meta charset="utf-8"><title>Shared-depth diagnostic</title><script src="/comparison.js" defer></script>';
const files = new Map([
  ["/comparison.js", [resolve(qa, "comparison.js"), "text/javascript"]],
  ["/person.png", [resolve("public/demos/pixel-characters/person-32.png"), "image/png"]],
  ["/tiger.glb", [resolve(sourceRoot, "blender--tiger.glb"), "model/gltf-binary"]],
]);
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (pathname === "/") {
      response.setHeader("Content-Type", "text/html");
      response.end(html);
      return;
    }
    const file = files.get(pathname);
    if (!file) {
      response.statusCode = 404;
      response.end();
      return;
    }
    response.setHeader("Content-Type", file[1]);
    response.end(await readFile(file[0]));
  } catch {
    response.statusCode = 500;
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
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => window.comparisonReady || window.comparisonError);
  assert.equal(await page.evaluate(() => window.comparisonError), undefined);
  const results = [];
  const captures = [];
  for (const [heading, tilt] of [
    [0, 0],
    [45, 0],
    [0, 25],
    [45, 25],
  ]) {
    const result = await page.evaluate(
      ([heading, tilt]) => window.compare3d(heading, tilt),
      [heading, tilt],
    );
    captures.push({ heading, tilt, images: result.captures });
    delete result.captures;
    results.push(result);
    console.log(JSON.stringify(result));
    for (const [mode, png] of Object.entries(captures.at(-1).images))
      await writeFile(
        resolve(qa, `${heading}-${tilt}-${mode}.png`),
        Buffer.from(png.split(",")[1], "base64"),
      );
  }
  const animated = await page.evaluate(() => window.inspectAnimatedSource());
  const animatedCaptures = animated.samples.map((sample) => sample.png);
  for (const sample of animated.samples) delete sample.png;
  await page.evaluate(() => window.dispose3d());
  const sourcePaths = [
    "scripts/instrumentation/live-3d-comparison-entry.mjs",
    "scripts/instrumentation/live-3d-comparison.mjs",
    "src/rendering/CarMeshProjection.ts",
    "public/demos/pixel-characters/person-32.png",
  ];
  const sourceHashes = Object.fromEntries(
    await Promise.all(
      sourcePaths.map(async (path) => [
        path,
        createHash("sha256")
          .update(await readFile(resolve(root, path)))
          .digest("hex"),
      ]),
    ),
  );
  const report = {
    schema: "tilefun-shared-depth-comparison-v1",
    browser: browser.version(),
    scope:
      "Schematic GPU-only fixture using production projection and unchanged Explorer sprite; not production integration, collision, fallback or performance qualification",
    sourceHashes,
    trialGlbSha256: createHash("sha256")
      .update(await readFile(resolve(sourceRoot, "blender--tiger.glb")))
      .digest("hex"),
    errors,
    results,
    animatedRawExport: animated,
  };
  await writeFile(resolve(qa, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  const modes = ["isolated", "local", "world"];
  const gallery = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Live 3D / shared depth investigation</title>
    <style>body{font:16px system-ui;background:#eee;color:#202936;margin:24px}main{max-width:1200px;margin:auto}section{display:flex;flex-wrap:wrap;gap:16px;margin-bottom:30px}figure{margin:0}img{width:320px;height:320px;image-rendering:pixelated;background:repeating-conic-gradient(#d4dbd7 0% 25%,#e4eae6 0% 50%) 0/16px 16px}figcaption{max-width:320px}code{font-size:14px}</style>
    <main><h1>Live 3D and shared depth</h1><p>Rendering-only diagnostic. Schematic bed; unchanged Explorer standing sprite. No physical cargo or production renderer changes.</p>
    <p>Left: isolated bed image + whole sprite on top. Middle: bed and sprite depth-tested together, then composited. Right: same objects in one world-depth render.</p>
    ${captures.map((row) => `<h2>Heading ${row.heading}°, tilt ${row.tilt}°</h2><section>${modes.map((mode) => `<figure><img alt="${mode}, heading ${row.heading}, tilt ${row.tilt}" src="${row.images[mode]}"><figcaption>${mode}</figcaption></figure>`).join("")}</section>`).join("")}
    <h2>Unmodified upright-tiger GLB export</h2><p>The skeleton plays, but the Blender toon graph loses orange/cream separation: black base factors plus white emission. This is raw export evidence, not an appearance candidate.</p><section>${animatedCaptures.map((png, index) => `<figure><img alt="Raw tiger animation at ${animated.samples[index].time}s" src="${png}"><figcaption>${animated.samples[index].time}s — ${animated.samples[index].drawCalls} draw calls</figcaption></figure>`).join("")}</section></main>`;
  await writeFile(resolve(qa, "index.html"), gallery);
  await page.setContent(gallery);
  await page.setViewportSize({ width: 1150, height: 900 });
  await page.screenshot({ path: resolve(qa, "overview.png"), fullPage: true });
  assert.deepEqual(errors, []);
  assert.ok(results.every((row) => row.hiddenActorPixels > 0 && row.visibleActorPixels > 0));
  assert.ok(
    results.every((row) => row.rayOracleMismatches === 0 && row.localVersusWorldPixels === 0),
  );
  assert.ok(
    animated.samples[1].changedChannels > 0,
    "Exported skeletal animation must change rendered pixels",
  );
  console.log(`Shared-depth comparison passed. Gallery: ${resolve(qa, "index.html")}`);
} finally {
  await browser?.close();
  await new Promise((done, reject) => server.close((error) => (error ? reject(error) : done())));
}

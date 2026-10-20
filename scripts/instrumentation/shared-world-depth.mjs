/** Actual asset GPU comparison; exhaustive group ordering stays on the CPU. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve, sep } from "node:path";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import { build } from "vite";

const output = resolve(
  process.argv.find((arg) => arg.startsWith("--output="))?.slice(9) ??
    "data/3d-investigation/shared-world",
);
assert.ok(output.startsWith(resolve("data") + sep));
await mkdir(output, { recursive: true });
const fixturePath = resolve("data/3d-investigation/shared-world/fixture.json");
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const vehicleMaterials = {};
for (const name of ["dump-truck", "pickup"]) {
  const bytes = await readFile(`public/assets/models/vehicles/${name}-v1.glb`);
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
  const document = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString("utf8"));
  const modes = document.materials.map((material) => material.alphaMode ?? "OPAQUE");
  assert.ok(
    modes.every((mode) => mode === "OPAQUE"),
    "The label oracle requires opaque vehicle materials",
  );
  vehicleMaterials[name] = modes;
}
await build({
  configFile: false,
  publicDir: false,
  base: "/",
  logLevel: "error",
  build: {
    outDir: output,
    emptyOutDir: false,
    minify: true,
    lib: {
      entry: resolve("scripts/instrumentation/shared-world-depth-entry.mjs"),
      name: "SharedWorld",
      formats: ["iife"],
      fileName: () => "comparison.js",
    },
  },
});
const routes = new Map([
  ["/comparison.js", [resolve(output, "comparison.js"), "text/javascript"]],
  ["/fixture.json", [fixturePath, "application/json"]],
  ["/person.png", [resolve("public/demos/pixel-characters/person-32.png"), "image/png"]],
  ["/cat.png", [resolve("public/demos/pixel-characters/cat-32.png"), "image/png"]],
]);
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (pathname === "/") {
      response.setHeader("Content-Type", "text/html");
      response.end('<!doctype html><script src="/comparison.js" defer></script>');
      return;
    }
    const file =
      routes.get(pathname) ??
      (pathname.startsWith("/assets/models/vehicles/") &&
      /^\/assets\/models\/vehicles\/[\w-]+\.glb$/.test(pathname)
        ? [resolve(`public${pathname}`), "model/gltf-binary"]
        : null);
    if (!file) {
      response.statusCode = 404;
      response.end(pathname);
      return;
    }
    response.setHeader("Content-Type", file[1]);
    response.end(await readFile(file[0]));
  } catch (error) {
    response.statusCode = 500;
    response.end(String(error));
  }
});
const decode = (url) => PNG.sync.read(Buffer.from(url.split(",")[1], "base64"));
const labelAt = (image, index) =>
  image.data[index * 4 + 3]
    ? (image.data[index * 4] << 16) | (image.data[index * 4 + 1] << 8) | image.data[index * 4 + 2]
    : 0;
function crop(url, item) {
  const image = decode(url),
    cropped = new PNG({ width: 44, height: 44 });
  const x = Math.floor(item.wx - fixture.viewport.centerX + image.width / 2 - 22);
  const y = Math.floor(
    item.wy -
      fixture.viewport.centerY -
      item.zOffset -
      item.spriteHeight +
      item.drawOffsetY +
      image.height / 2 -
      6,
  );
  PNG.bitblt(image, cropped, x, y, 44, 44, 0, 0);
  return `data:image/png;base64,${PNG.sync.write(cropped).toString("base64")}`;
}
function analyze(result) {
  const local = decode(result.captures.localIds),
    world = decode(result.captures.worldIds);
  const solo = result.solo.map((entry) => ({ ...entry, image: decode(entry.png) }));
  const buckets = new Map(),
    pairCounts = Array.from({ length: solo.length }, () => Array(solo.length).fill(0));
  const heat = new PNG({ width: world.width, height: world.height });
  let differences = 0,
    vehicleOverlap = 0;
  for (let pixel = 0; pixel < world.width * world.height; pixel++) {
    const winner = labelAt(world, pixel);
    let mask = 0;
    for (let i = 0; i < solo.length; i++) if (solo[i].image.data[pixel * 4 + 3]) mask |= 1 << i;
    const key = `${mask}:${winner}`;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
    const a = solo.findIndex((entry) => entry.label === winner);
    if (a >= 0)
      for (let b = 0; b < solo.length; b++) if (b !== a && mask & (1 << b)) pairCounts[a][b]++;
    if (
      solo
        .filter((entry) => ["dump-truck", "pickup"].includes(entry.key))
        .every((entry) => entry.image.data[pixel * 4 + 3])
    )
      vehicleOverlap++;
    if (labelAt(local, pixel) !== winner) {
      differences++;
      heat.data.set([255, 40, 90, 255], pixel * 4);
    }
  }
  const entries = [...buckets].map(([key, count]) => {
    const [mask, winner] = key.split(":").map(Number);
    return { mask, winner, count };
  });
  let predictedError = 0;
  for (const { mask, winner, count } of entries) {
    let predicted = 0;
    for (let i = 0; i < solo.length; i++) if (mask & (1 << i)) predicted = solo[i].label;
    if (predicted !== winner) predictedError += count;
  }
  assert.equal(
    predictedError,
    differences,
    "Solo masks must reproduce the actual grouped GPU result",
  );
  let bestError = Infinity,
    bestOrder,
    permutations = 0;
  function visit(order, remaining) {
    if (remaining.length) {
      for (const i of remaining)
        visit(
          [...order, i],
          remaining.filter((j) => j !== i),
        );
      return;
    }
    permutations++;
    let error = 0;
    for (const { mask, winner, count } of entries) {
      let actual = 0;
      for (const i of order) if (mask & (1 << i)) actual = solo[i].label;
      if (actual !== winner) error += count;
    }
    if (error < bestError) {
      bestError = error;
      bestOrder = order.map((i) => solo[i].key);
    }
  }
  visit(
    [],
    solo.map((_, i) => i),
  );
  const twoWayConstraints = [];
  for (let a = 0; a < solo.length; a++)
    for (let b = a + 1; b < solo.length; b++)
      if (pairCounts[a][b] && pairCounts[b][a])
        twoWayConstraints.push({
          a: solo[a].key,
          b: solo[b].key,
          aInFront: pairCounts[a][b],
          bInFront: pairCounts[b][a],
        });
  return {
    metrics: {
      differentPixels: differences,
      vehicleOverlap,
      bestWholeGroupError: bestError,
      bestWholeGroupOrder: bestOrder,
      permutations,
      twoWayConstraints,
    },
    heatmap: `data:image/png;base64,${PNG.sync.write(heat).toString("base64")}`,
  };
}
await new Promise((done) => server.listen(0, "127.0.0.1", done));
let browser;
try {
  browser = await chromium.launch({ channel: "chromium", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1200, height: 900 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => window.sharedWorld?.ready || window.sharedWorldError);
  assert.equal(await page.evaluate(() => window.sharedWorldError), undefined);
  const results = [],
    pictures = [];
  for (const snapshot of fixture.cases) {
    const capture = await page.evaluate((id) => window.sharedWorld.capture(id), snapshot.id);
    const { metrics, heatmap } = analyze(capture);
    pictures.push({
      id: capture.id,
      name: capture.name,
      captures: capture.captures,
      closeups: Object.fromEntries(
        ["local", "world"].map((key) => [
          key,
          crop(
            capture.captures[key],
            snapshot.objects.find((record) => record.key === "person").item,
          ),
        ]),
      ),
      heatmap,
      metrics,
      playerZ: capture.playerZ,
    });
    const { captures: _images, solo: _solo, ...summary } = capture;
    results.push({ ...summary, ...metrics });
    for (const [name, url] of Object.entries(capture.captures))
      await writeFile(
        resolve(output, `${capture.id}-${name}.png`),
        Buffer.from(url.split(",")[1], "base64"),
      );
    assert.equal(capture.oracle.mismatches, 0, JSON.stringify(capture.oracle));
    console.log(
      `${capture.id}: ${metrics.differentPixels} different; best scalar ${metrics.bestWholeGroupError}; ray checks ${capture.oracle.checked}; ambiguous ${capture.oracle.ambiguous}`,
    );
  }
  assert.deepEqual(errors, []);
  assert.ok(results.every((result) => result.vehicleOverlap > 0));
  assert.ok(
    results.some((result) => result.bestWholeGroupError > 0 && result.twoWayConstraints.length),
  );
  assert.ok(results.some((result) => result.differentPixels === 0));
  const paths = [
    "scripts/instrumentation/shared-world-depth-fixture.ts",
    "scripts/instrumentation/shared-world-depth-entry.mjs",
    "scripts/instrumentation/shared-world-depth.mjs",
    "src/rendering/CarMeshProjection.ts",
    "src/rendering/CarMeshAsset.ts",
    "src/rendering/collectScene.ts",
    "public/assets/models/vehicles/dump-truck-v1.glb",
    "public/assets/models/vehicles/pickup-v1.glb",
    "public/demos/pixel-characters/person-32.png",
    "public/demos/pixel-characters/cat-32.png",
  ];
  const hashes = Object.fromEntries(
    await Promise.all(
      paths.map(async (path) => [
        path,
        createHash("sha256")
          .update(await readFile(path))
          .digest("hex"),
      ]),
    ),
  );
  await writeFile(
    resolve(output, "report.json"),
    `${JSON.stringify({ schema: "tilefun-shared-world-depth-v1", fixtureSource: fixture.source, worker: false, viewport: fixture.viewport, vehicleMaterials, hashes, results, limits: ["Standalone GPU harness using authority snapshots, not a Worker or RenderHost integration", "Unchanged character billboards provide planar artwork depth, not anatomical geometry", "Same end-of-scene outline on both modes; visibility measured before outlines", "Flat background has no terrain depth; both vehicle GLBs verified OPAQUE"] }, null, 2)}\n`,
  );
  const gallery = `<!doctype html><meta charset="utf-8"><title>Shared world depth comparison</title><style>body{font:16px system-ui;background:#17232c;color:#eff4f8;margin:24px}h1{font-size:24px}select,button{font:inherit;padding:6px}figure{margin:0}img{width:512px;height:448px;image-rendering:pixelated;background:#88a77b}.grid{display:flex;gap:20px;margin-top:18px}figcaption{margin:8px 0}p{max-width:1080px;line-height:1.5}.close{width:264px;height:264px}.heat{width:256px;height:192px}small{color:#bbcedb}</style><h1>Vehicle groups vs shared world depth</h1><p>Actual dump truck and pickup; unchanged Explorer and cat sprites. Normal authority positions and scene ordering. Blue: physical bodies; green: wall bodies; yellow: sprite planes.</p><select id="which"></select> <button id="debug">Show clipping geometry</button><p id="stats"></p><div class="grid"><figure><figcaption>Local depth, then whole objects in scene order</figcaption><img id="local"></figure><figure><figcaption>Shared world depth</figcaption><img id="world"></figure></div><p id="finding"></p><div class="grid"><figure><figcaption>Local close-up (6x)</figcaption><img class="close" id="localClose"></figure><figure><figcaption>Shared-depth close-up (6x)</figcaption><img class="close" id="worldClose"></figure></div><p></p><small>Visibility comparison uses opaque labels before a common final outline. Experimental renderer; game rendering is unchanged. Sprites are upright planes, not 3D characters.</small><script>const cases=${JSON.stringify(pictures).replaceAll("<", "\\u003c")};let debug=false;const selector=document.querySelector('#which');for(const c of cases)selector.add(new Option(c.name,c.id));selector.value='wall-corner';function draw(){const c=cases.find(c=>c.id===selector.value);document.querySelector('#localClose').src=c.closeups.local;document.querySelector('#worldClose').src=c.closeups.world;document.querySelector('#local').src=c.captures[debug?'localDebug':'local'];document.querySelector('#world').src=c.captures[debug?'worldDebug':'world'];document.querySelector('#stats').textContent='Native 256 x 224 | player height '+c.playerZ.toFixed(2)+' | '+c.metrics.differentPixels+' pixels differ | best of all 720 whole-object orders: '+c.metrics.bestWholeGroupError+' incorrect pixels';document.querySelector('#finding').textContent=c.metrics.bestWholeGroupError?'Whole-object reordering cannot reproduce this shared-depth view. '+c.metrics.twoWayConstraints.map(p=>p.a+' / '+p.b+': '+p.aInFront+' pixels one way, '+p.bInFront+' the other').join('; '):'A whole-object order can reproduce this view. Shared depth is not required for this pose.'}selector.onchange=draw;document.querySelector('#debug').onclick=()=>{debug=!debug;draw()};draw();</script>`;
  await writeFile(resolve(output, "index.html"), gallery);
  await page.evaluate(() => window.sharedWorld.dispose());
  await page.setContent(gallery);
  await page.screenshot({ path: resolve(output, "overview.png"), fullPage: true });
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}

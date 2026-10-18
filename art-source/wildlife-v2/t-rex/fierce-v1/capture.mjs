import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { chromium } from "playwright";

const species = "t-rex";
const root = resolve("public"),
  output = resolve(`data/fierce-137/${species}/browser`);
await mkdir(output, { recursive: true });
const server = createServer(async (request, response) => {
  const path = resolve(
    root,
    `.${decodeURIComponent(new URL(request.url, "http://localhost").pathname)}`,
  );
  if (!path.startsWith(root + sep)) return response.writeHead(403).end();
  try {
    response.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".js": "text/javascript",
        ".json": "application/json",
        ".png": "image/png",
      }[extname(path)] ?? "application/octet-stream",
    );
    response.end(await readFile(path));
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
let browser;
try {
  browser = await chromium.launch({ channel: "chromium", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1800, height: 1200 },
    deviceScaleFactor: 2,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  await page.goto(
    `http://127.0.0.1:${server.address().port}/demos/wildlife-v2/${species}/fierce-v1/index.html`,
  );
  await page.waitForFunction(() => window.fierceDraft?.ready);
  const metadata = JSON.parse(
    await readFile(`public/demos/wildlife-v2/${species}/fierce-v1/sprite.json`, "utf8"),
  );
  const results = [];
  for (const scale of [1, 4]) {
    await page.selectOption("#scale", String(scale));
    const checked = await page.evaluate(async (metadata) => {
      const source = new Image();
      source.src = "sheet.png";
      await source.decode();
      const background = new Image();
      background.src = "scene-background.png";
      await background.decode();
      const explorer = new Image();
      explorer.src = "../../../pixel-characters/person-32.png";
      await explorer.decode();
      const size = metadata.frameWidth;
      const expected = document.createElement("canvas"),
        scene = document.createElement("canvas");
      expected.width = size * 4;
      expected.height = size;
      scene.width = background.width;
      scene.height = background.height;
      const ctx = expected.getContext("2d", { willReadFrequently: true }),
        sceneCtx = scene.getContext("2d", { willReadFrequently: true });
      if (!ctx || !sceneCtx) throw Error("Missing capture contexts");
      let poses = 0,
        cropChecks = 0,
        sceneChecks = 0;
      for (const [name, clip] of Object.entries(metadata.clips))
        for (let index = 0; index < clip.count; index++) {
          const travel = ["walk", "charge"].includes(name)
            ? (index / clip.count) * clip.rootTravelPixelsPerCycle
            : 0;
          window.fierceDraft.inspect(name, index, travel);
          ctx.fillStyle = "#879b82";
          ctx.fillRect(0, 0, expected.width, expected.height);
          sceneCtx.clearRect(0, 0, scene.width, scene.height);
          sceneCtx.drawImage(background, 0, 0);
          Object.keys(metadata.facings).forEach((facing, row) => {
            const x = (clip.start + index) * size;
            ctx.drawImage(source, x, row * size, size, size, row * size, 0, size, size);
            const yaw = (metadata.cameraContract.modelYawDegrees[facing] * Math.PI) / 180;
            const dx = Math.round(-Math.sin(yaw) * travel),
              dy = Math.round(-Math.sin((40 * Math.PI) / 180) * Math.cos(yaw) * travel);
            sceneCtx.drawImage(
              source,
              x,
              row * size,
              size,
              size,
              110 + row * 230 - metadata.anchor[0] + dx,
              220 - metadata.anchor[1] + dy,
              size,
              size,
            );
            sceneCtx.drawImage(explorer, 0, row * 32, 32, 32, 45 + row * 230, 192, 32, 32);
            cropChecks++;
          });
          if (document.querySelector("#sprites").toDataURL() !== expected.toDataURL())
            throw Error(`Wrong native sprite pixels: ${name}/${index}`);
          if (document.querySelector("#playback").toDataURL() !== scene.toDataURL())
            throw Error(`Wrong scene pixels: ${name}/${index}`);
          poses++;
          sceneChecks++;
        }
      return {
        chronologicalPoses: poses,
        exactCropChecks: cropChecks,
        exactSceneChecks: sceneChecks,
      };
    }, metadata);
    assert.equal(
      checked.chronologicalPoses,
      Object.values(metadata.clips).reduce((n, c) => n + c.count, 0),
    );
    await page.evaluate(() => window.fierceDraft.inspect("idle", 0));
    await page.locator("#playback").screenshot({ path: `${output}/scene-${scale}x.png` });
    results.push({ scale, ...checked, errors });
  }
  // Also observe the real unpaused timeline, rather than relying only on inspect().
  await page.selectOption("#scale", "1");
  await page.click("#reset");
  const seen = new Set(),
    started = Date.now();
  while (Date.now() - started < 9000) {
    seen.add(await page.locator("#playback").getAttribute("data-clip"));
    await new Promise((done) => setTimeout(done, 20));
  }
  for (const clip of Object.keys(metadata.clips))
    assert(seen.has(clip), `Timeline omitted ${clip}`);
  assert.deepEqual(errors, []);
  await writeFile(
    `${output}/capture.json`,
    `${JSON.stringify({ species, results, playbackClips: [...seen], errors }, null, 2)}\n`,
  );
  console.log(JSON.stringify({ species, results, playbackClips: [...seen], errors }));
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}

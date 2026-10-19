// Actual full Chromium + shared Three.js engine semantics; no primary browser.

import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";
import { PNG } from "pngjs";

const rev = process.argv[2] ?? "v2";
const root = process.cwd(),
  publicRoot = path.join(root, "public");
const out = path.join(root, "public/demos/vehicle-bake/a-reduced-projection", rev, "engine");
const prior = JSON.parse(await fs.readFile(path.join(out, "../report.json"), "utf8"));
if (prior.status === "complete")
  throw Error("Finished revision is immutable; select a new revision");
await fs.mkdir(out, { recursive: true });
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
  ".png": "image/png",
};
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    let file = path.resolve(publicRoot, `.${pathname}`);
    if (!file.startsWith(publicRoot + path.sep)) throw Error("outside");
    const stat = await fs.stat(file);
    if (stat.isDirectory()) file = path.join(file, "index.html");
    res.setHeader("Content-Type", types[path.extname(file)] ?? "application/octet-stream");
    res.end(await fs.readFile(file));
  } catch {
    res.statusCode = 404;
    res.end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    channel: "chromium",
    args: ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
  });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/demos/vehicle-bake/index.html`);
  await page.waitForFunction(() => window.vehicleBakeReady);
  await page.evaluate(
    async ({ rev }) =>
      window.vehicleBake.load({
        id: `a-${rev}`,
        title: `A ${rev}`,
        glb: `a-reduced-projection/${rev}/model.glb`,
        atlas: `a-reduced-projection/${rev}/atlas.png`,
        report: `a-reduced-projection/${rev}/report.json`,
      }),
    { rev },
  );
  const materialAudit = await page.evaluate(() => {
    const asset = window.vehicleBake.state.asset,
      materials = [],
      rig = [];
    asset.object.traverse((o) => {
      if (o.isMesh)
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          materials.push({
            mesh: o.name,
            type: m.type,
            unlit: m.isMeshBasicMaterial === true,
            map: !!m.map,
            emissive: m.emissive?.toArray(),
            emissiveMap: !!m.emissiveMap,
          });
      if (o.name.match(/^Wheel_.*_(Roll|Steer)$/))
        rig.push({ name: o.name, parent: o.parent?.name, extras: o.userData });
    });
    return { materials, rig, stats: window.vehicleBake.state.stats };
  });
  if (!materialAudit.materials.every((m) => m.unlit && m.map && !m.emissiveMap))
    throw Error("Actual GLTFLoader material is not clean unlit atlas");
  const samples = [];
  for (const mode of ["study", "engine"])
    for (let i = 0; i < 16; i++) {
      const result = await page.evaluate(({ yaw, mode }) => window.vehicleBake.pose(yaw, 0, mode), {
        yaw: i * 22.5,
        mode,
      });
      const png = new PNG({ width: 128, height: 128 });
      png.data = Buffer.from(result.pixels);
      const name = `${mode}-${String(i).padStart(2, "0")}.png`;
      await fs.writeFile(path.join(out, name), PNG.sync.write(png));
      samples.push({
        name,
        yaw: i * 22.5,
        stats: result.stats,
        opaque: result.pixels.filter((v, k) => k % 4 === 3 && v > 0).length,
      });
    }
  const radius = (80 / 4.6) * 0.34;
  for (let i = 0; i < 8; i++) {
    const result = await page.evaluate(
      ({ distance }) => window.vehicleBake.pose(45, distance, "study"),
      { distance: ((i * Math.PI) / 4) * radius },
    );
    const png = new PNG({ width: 128, height: 128 });
    png.data = Buffer.from(result.pixels);
    await fs.writeFile(path.join(out, `roll-${i}.png`), PNG.sync.write(png));
  }
  const independentRoll = await page.evaluate(() => {
    const asset = window.vehicleBake.state.asset;
    asset.setTravel(0);
    asset.object.updateMatrixWorld(true);
    const wheels = ["FL", "FR", "RL", "RR"].map((k) =>
      asset.object.getObjectByName(`Wheel_${k}_Roll`),
    );
    const fixed = [];
    asset.object.traverse((o) => {
      if (o.isMesh && !o.name.startsWith("Wheel_")) fixed.push(o);
    });
    const before = new Map([...wheels, ...fixed].map((o) => [o, o.matrixWorld.toArray()]));
    const results = [];
    for (const roll of wheels) {
      const q = roll.quaternion.clone();
      roll.rotateOnAxis({ x: 0, y: 0, z: -1 }, Math.PI / 2);
      asset.object.updateMatrixWorld(true);
      results.push({
        name: roll.name,
        changed: roll.matrixWorld
          .toArray()
          .some((v, i) => Math.abs(v - before.get(roll)[i]) > 1e-8),
        othersUnchanged: [...wheels, ...fixed]
          .filter((o) => o !== roll)
          .every((o) =>
            o.matrixWorld.toArray().every((v, i) => Math.abs(v - before.get(o)[i]) < 1e-8),
          ),
      });
      roll.quaternion.copy(q);
      asset.object.updateMatrixWorld(true);
    }
    return results;
  });
  await page.evaluate(() => window.vehicleBake.pose(45, 0, "study"));
  await page.screenshot({ path: path.join(out, "viewer.png"), fullPage: true });
  const receipt = {
    browser: "Bundled Playwright full Chromium / SwiftShader WebGL",
    noLights: true,
    sharedComponents: ["CarMeshAsset(scene,1,{batch:true})", "CarPixelOutline"],
    materialAudit,
    independentRoll,
    samples,
    errors,
  };
  await fs.writeFile(path.join(out, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(
    JSON.stringify(
      { materials: materialAudit.materials, independentRoll, errors, samples: samples.length },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
}

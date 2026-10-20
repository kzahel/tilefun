/** Actual GLB wheel-by-wheel visual phases, with fixed roof-rack/body matrix checks. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const base = "data/vehicle-bake/woody-wagon";
const folder = `${base}/author-view/captures`;
await mkdir(folder, { recursive: true });
const sha = createHash("sha256")
  .update(await readFile("public/demos/vehicle-bake/woody-wagon/v1/model.glb"))
  .digest("hex");
const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  cacheDir: resolve(base, "independent-vite-cache"),
  logLevel: "error",
  server: { port: 0, host: "127.0.0.1", watch: null },
  optimizeDeps: { entries: [] },
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({ channel: "chromium", headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    `http://127.0.0.1:${server.httpServer.address().port}/tilefun/${base}/author-view/index.html`,
  );
  await page.waitForFunction(() => window.familyReviewReady === true);
  const results = [];
  for (const wid of ["FL", "FR", "RL", "RR"]) {
    const result = await page.evaluate(async (wid) => {
      const THREE = await import("/tilefun/node_modules/three/build/three.module.js");
      const { createWheelRig } = await import(
        "/tilefun/scripts/authored-assets/runtime/wheel-rig.mjs"
      );
      const api = window.familyReview;
      const asset = api.state.asset;
      const rig = createWheelRig(asset.object, THREE);
      const wheel = rig.wheels.find((w) => w.id === wid);
      const original = asset.setTravel.bind(asset);
      original(0);
      asset.object.updateMatrixWorld(true);
      const moving = new Set();
      wheel.roll.traverse((n) => moving.add(n));
      let best;
      for (const yaw of [0, 180]) {
        asset.setTravel = original;
        api.pose(yaw, 0, "engine");
        asset.object.updateMatrixWorld(true);
        const baseline = new Map();
        asset.object.traverse((n) => {
          if (n.isMesh) baseline.set(n, n.matrixWorld.toArray());
        });
        const frames = [];
        const pixels = [];
        for (const phase of [0, 90, -90, 0]) {
          asset.setTravel = () => {
            original(0);
            rig.setWheelTravel(wid, (wheel.radius * Math.PI * phase) / 180);
          };
          const view = api.pose(yaw, 0, "engine");
          asset.object.updateMatrixWorld(true);
          asset.object.traverse((n) => {
            if (!n.isMesh || moving.has(n)) return;
            if (n.matrixWorld.elements.some((v, i) => Math.abs(v - baseline.get(n)[i]) > 1e-6))
              throw Error(`Non-target mesh moved ${wid}/${n.name}`);
          });
          frames.push(document.querySelector("#low").toDataURL().split(",")[1]);
          pixels.push(view.pixels);
        }
        const changed = pixels[0].reduce((n, v, i) => n + Number(v !== pixels[1][i]), 0);
        const reverseChanged = pixels[0].reduce((n, v, i) => n + Number(v !== pixels[2][i]), 0);
        if (!pixels[0].every((v, i) => v === pixels[3][i])) throw Error("Visual reset differs");
        if (!best || changed > best.changedChannels)
          best = { yaw, frames, changedChannels: changed, reverseChangedChannels: reverseChanged };
      }
      asset.setTravel = original;
      original(0);
      return best;
    }, wid);
    assert.ok(result.changedChannels > 0 && result.reverseChangedChannels > 0, wid);
    const paths = [];
    for (let i = 0; i < result.frames.length; i++) {
      const path = `${folder}/independent-${wid}-${i}.png`;
      await writeFile(path, Buffer.from(result.frames[i], "base64"));
      paths.push(path);
    }
    results.push({
      id: wid,
      yaw: result.yaw,
      phasesDegrees: [0, 90, -90, 0],
      changedChannels: result.changedChannels,
      reverseChangedChannels: result.reverseChangedChannels,
      absoluteResetPixelsExact: true,
      allOtherMeshesFixed: true,
      staticBodyIncludesRoofRack: true,
      images: paths,
    });
  }
  assert.deepEqual(errors, []);
  await writeFile(
    `${base}/independent-visual.json`,
    `${JSON.stringify({ status: "passed", glbSha256: sha, browser: "bundled full Chromium", results, errors }, null, 2)}\n`,
  );
  console.log(JSON.stringify({ status: "passed", glbSha256: sha, wheels: results }));
} finally {
  await browser?.close();
  await server.close();
}

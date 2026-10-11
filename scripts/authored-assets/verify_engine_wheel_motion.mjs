/** Actual retained GLBs through CarMeshAsset: every exported wheel must roll. */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const output = resolve(process.argv[2]);
const root = resolve(process.argv[3] ?? ".");
await mkdir(output, { recursive: false });
const catalog = JSON.parse(
  await readFile(resolve(root, "art-source/vehicle-models/catalog.json"), "utf8"),
);
const latest = new Map();
for (const bundle of catalog.bundles) {
  const old = latest.get(bundle.assetId);
  if (!old || Number(bundle.revision.slice(1)) > Number(old.revision.slice(1)))
    latest.set(bundle.assetId, bundle);
}
const cases = [];
for (const bundle of latest.values()) {
  const rig = JSON.parse(await readFile(resolve(root, bundle.source, "rig.json"), "utf8"));
  cases.push({
    vehicle: bundle.assetId,
    revision: bundle.revision,
    url: `/tilefun/${bundle.glb.replace(/^public\//, "")}`,
    ids: rig.wheels.map((w) => w.id),
  });
}
const server = await createServer({
  root,
  configFile: false,
  base: "/tilefun/",
  cacheDir: resolve(output, "vite-cache"),
  logLevel: "error",
  server: { port: 0, host: "127.0.0.1", watch: null },
  optimizeDeps: { entries: [], include: ["three", "three/addons/loaders/GLTFLoader.js"] },
  plugins: [
    {
      name: "engine-wheel-probe",
      configureServer(s) {
        s.middlewares.use((req, res, next) => {
          if (req.url !== "/tilefun/__engine_wheels") return next();
          res.setHeader("Content-Type", "text/html");
          res.end("<!doctype html><body></body>");
        });
      },
    },
  ],
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({ channel: "chromium", headless: true });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tilefun/__engine_wheels`);
  const reports = [];
  for (const entry of cases) {
    const report = await page.evaluate(async ({ url, ids }) => {
      const { THREE, GLTFLoader } = await import(
        "/tilefun/scripts/authored-assets/runtime/glb-imports.mjs"
      );
      const { CarMeshAsset } = await import("/tilefun/src/rendering/CarMeshAsset.ts");
      const { scene } = await new GLTFLoader().loadAsync(url);
      const rolls = ids.map((id) => scene.getObjectByName(`Wheel_${id}_Roll`));
      if (rolls.some((node) => !node)) throw Error("Missing declared wheel");
      const rest = rolls.map((node) => node.quaternion.clone());
      const asset = new CarMeshAsset(scene, 1);
      try {
        asset.object.updateMatrixWorld(true);
        const centers = rolls.map((node) => node.getWorldPosition(new THREE.Vector3()));
        const body = scene.getObjectByName("Body");
        const fixed = [];
        body.traverse((node) => fixed.push([node.name, [...node.matrixWorld.elements]]));
        for (const travel of [12, -12, 0, 7, 0]) {
          asset.setTravel(travel);
          asset.object.updateMatrixWorld(true);
          for (let n = 0; n < rolls.length; n++) {
            const roll = rolls[n];
            const expected = rest[n]
              .clone()
              .multiply(
                new THREE.Quaternion().setFromAxisAngle(
                  new THREE.Vector3(...roll.userData.roll_axis_gltf).normalize(),
                  -travel / roll.userData.wheel_radius,
                ),
              );
            if (roll.quaternion.angleTo(expected) > 1e-6)
              throw Error(`Engine did not roll ${ids[n]} by its radius`);
            if (roll.getWorldPosition(new THREE.Vector3()).distanceTo(centers[n]) > 1e-5)
              throw Error("Engine moved a wheel pivot");
          }
          const after = [];
          body.traverse((node) => after.push([node.name, [...node.matrixWorld.elements]]));
          if (JSON.stringify(after) !== JSON.stringify(fixed))
            throw Error("Engine wheel travel moved body/equipment");
        }
        return {
          wheels: ids,
          signedRadiusRoll: true,
          centersFixed: true,
          bodyFixed: true,
          absoluteReset: true,
        };
      } finally {
        asset.dispose();
      }
    }, entry);
    reports.push({ vehicle: entry.vehicle, revision: entry.revision, ...report });
  }
  assert.equal(reports.length, cases.length);
  await writeFile(
    resolve(output, "engine-wheel-motion.json"),
    `${JSON.stringify(reports, null, 2)}\n`,
  );
  console.log(`Actual engine wheel motion passed for ${reports.length} retained vehicles.`);
} finally {
  await browser?.close();
  await server.close();
}

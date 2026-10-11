/** Actual exported wheel vertices must clear every separately declared floor end. */
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
const cases = [];
for (const bundle of catalog.bundles) {
  const rig = JSON.parse(await readFile(resolve(root, bundle.source, "rig.json"), "utf8"));
  if (rig.wheelWellFit?.extraFloorMeshes?.length)
    cases.push({
      assetId: bundle.assetId,
      revision: bundle.revision,
      url: `/tilefun/${bundle.glb.replace(/^public\//, "")}`,
      names: rig.wheelWellFit.extraFloorMeshes,
    });
}
assert(cases.length, "No declared additional floor meshes");
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
      name: "floor-bevel-probe",
      configureServer(s) {
        s.middlewares.use((req, res, next) => {
          if (req.url !== "/tilefun/__floor_bevels") return next();
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
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tilefun/__floor_bevels`);
  const reports = [];
  for (const entry of cases) {
    const report = await page.evaluate(async ({ url, names }) => {
      const { THREE, GLTFLoader } = await import(
        "/tilefun/scripts/authored-assets/runtime/glb-imports.mjs"
      );
      const { createWheelRig } = await import(
        "/tilefun/scripts/authored-assets/runtime/wheel-rig.mjs"
      );
      const scene = (await new GLTFLoader().loadAsync(url)).scene;
      const rig = createWheelRig(scene, THREE);
      const body = scene.getObjectByName("Body");
      scene.updateMatrixWorld(true);
      const ends = names.map((name) => {
        const mesh = scene.getObjectByName(name);
        if (!mesh?.isMesh || mesh.parent !== body)
          throw new Error(`Missing fixed floor end ${name}`);
        return mesh;
      });
      const original = ends.map((mesh) => [...mesh.matrixWorld.elements]);
      const centers = rig.wheels.map((w) => w.roll.getWorldPosition(new THREE.Vector3()));
      // A sphere enclosing actual tire and hub vertices covers every rigid roll/steer rotation.
      function bounds() {
        return rig.wheels.map((wheel, index) => {
          const center = wheel.roll.getWorldPosition(new THREE.Vector3());
          if (center.distanceTo(centers[index]) > 1e-5) throw new Error("Wheel center moved");
          let radius = 0,
            vertices = 0;
          wheel.roll.traverse((mesh) => {
            if (!mesh.isMesh) return;
            const attr = mesh.geometry.attributes.position;
            for (let k = 0; k < attr.count; k++) {
              const point = mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(attr, k));
              radius = Math.max(radius, point.distanceTo(center));
              vertices++;
            }
          });
          if (!vertices || !radius) throw new Error("Wheel has no geometry");
          return { id: wheel.id, center, radius, vertices };
        });
      }
      const spheres = bounds();
      function check() {
        scene.updateMatrixWorld(true);
        const clearance = [];
        for (const mesh of ends) {
          const box = new THREE.Box3().setFromObject(mesh);
          for (const wheel of bounds()) {
            const gap = Math.max(
              box.min.x - wheel.center.x - wheel.radius,
              wheel.center.x - wheel.radius - box.max.x,
            );
            if (gap <= 1e-5) throw new Error(`Floor end cannot clear ${wheel.id}: ${mesh.name}`);
            clearance.push({ floor: mesh.name, wheel: wheel.id, gap });
          }
        }
        return clearance;
      }
      const clearance = check();
      for (const steering of [0, 0.2, -0.2]) {
        rig.setSteering(steering);
        for (const sign of [-1, 0, 1]) {
          for (const wheel of rig.wheels)
            rig.setWheelTravel(wheel.id, (sign * wheel.radius * Math.PI) / 2);
          check();
          if (
            ends.some(
              (mesh, i) =>
                JSON.stringify([...mesh.matrixWorld.elements]) !== JSON.stringify(original[i]),
            )
          )
            throw new Error("Floor end moved with wheel animation");
        }
      }
      rig.setTravel(0);
      rig.setSteering(0);
      scene.updateMatrixWorld(true);
      const selected = ends[0],
        rest = selected.position.clone();
      const box = new THREE.Box3().setFromObject(selected);
      const target = centers.reduce((best, c) =>
        Math.abs(c.x - box.getCenter(new THREE.Vector3()).x) <
        Math.abs(best.x - box.getCenter(new THREE.Vector3()).x)
          ? c
          : best,
      );
      const moved = selected.getWorldPosition(new THREE.Vector3());
      moved.x += target.x - box.getCenter(new THREE.Vector3()).x;
      selected.position.copy(selected.parent.worldToLocal(moved));
      let rejected = false;
      try {
        check();
      } catch (error) {
        rejected = error.message.includes("Floor end cannot clear");
      } finally {
        selected.position.copy(rest);
        scene.updateMatrixWorld(true);
      }
      if (!rejected) throw new Error("Probe accepted a floor end moved into a wheel");
      check();
      if (
        ends.some(
          (mesh, i) =>
            JSON.stringify([...mesh.matrixWorld.elements]) !== JSON.stringify(original[i]),
        )
      )
        throw new Error("Probe failed to restore exact floor transforms");
      scene.traverse((mesh) => {
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          material.map?.dispose();
          material.dispose();
        }
      });
      return {
        spheres: spheres.map(({ center, ...rest }) => ({ ...rest, center: center.toArray() })),
        clearance,
        poses: 9,
        fixed: true,
        movedFloorRejected: true,
        scope:
          "Additional floor ends clear enclosing wheel spheres; main floor and body checked separately",
      };
    }, entry);
    reports.push({ assetId: entry.assetId, revision: entry.revision, ...report });
  }
  await writeFile(resolve(output, "floor-bevels.json"), `${JSON.stringify(reports, null, 2)}\n`);
  console.log(JSON.stringify(reports));
} finally {
  await browser?.close();
  await server.close();
}

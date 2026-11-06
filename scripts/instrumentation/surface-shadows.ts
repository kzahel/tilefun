import { readFileSync, writeFileSync } from "node:fs";
import { arch, cpus, platform, release } from "node:os";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createPlayer } from "../../src/entities/Player.js";
import { Camera } from "../../src/rendering/Camera.js";
import { CarMeshAsset } from "../../src/rendering/CarMeshAsset.js";
import { collectScene } from "../../src/rendering/collectScene.js";
import { poseOrientation } from "../../src/rendering/MeshPresentation.js";
import { SceneFrame } from "../../src/rendering/SceneFrame.js";
import { createVehicle } from "../../src/traffic/Vehicle.js";

const loader = new GLTFLoader();
loader.register(() => ({ name: "node-texture", loadTexture: async () => new THREE.Texture() }));
const model = readFileSync("public/assets/models/vehicles/compact-1-v7.glb");
const gltf = await loader.parseAsync(
  model.buffer.slice(model.byteOffset, model.byteOffset + model.byteLength),
  "",
);
const asset = new CarMeshAsset(gltf.scene, 1.3, { batch: true, heightScale: 0.631 });
const world = { getHeightAt: () => 0, getChunkIfLoaded: () => undefined, getRoadAt: () => 0 };
const terrain = {
  collectElevationItems: () => [],
  meshSurfaceGeometry: () => asset.surfaceGeometry,
};
const summarize = (values: number[]) => {
  const a = [...values].sort((a, b) => a - b);
  return {
    samples: a.length,
    mean: a.reduce((a, b) => a + b, 0) / a.length,
    p95: a[Math.floor(a.length * 0.95)],
    p99: a[Math.floor(a.length * 0.99)],
    max: a.at(-1),
  };
};
const cases = [];
try {
  for (const name of [
    "96-characters",
    "96-characters-32-parked-roofs",
    "96-characters-32-moving-roofs",
  ]) {
    const cars = name.includes("roofs")
      ? Array.from({ length: 32 }, (_, i) => {
          const c = createVehicle(
            "compact-1",
            ((i % 8) - 3.5) * 90,
            (Math.floor(i / 8) - 1.5) * 90,
          );
          c.id = 1000 + i;
          c.wz = 0;
          c.bodyRotation = poseOrientation(0);
          return c;
        })
      : [];
    const actors = Array.from({ length: 96 }, (_, i) => {
      const c = cars[Math.floor(i / 3)],
        p = createPlayer(
          c ? c.position.wx + (i % 3 === 0 ? 0 : i % 3 === 1 ? -40 : 40) : ((i % 12) - 5.5) * 40,
          c ? c.position.wy : (Math.floor(i / 12) - 3.5) * 40,
        );
      p.id = i + 1;
      p.wz = c && i % 3 === 0 ? 24 : 0;
      return p;
    });
    const entities = [...actors, ...cars];
    for (let trial = 0; trial < 3; trial++)
      for (const current of trial % 2 ? [true, false] : [false, true]) {
        const frame = new SceneFrame(),
          camera = new Camera();
        camera.setViewport(1280, 900);
        camera.zoom = 0.4;
        camera.worldRaster = current;
        const samples: number[] = [];
        let finalStats = frame.receiverStats;
        for (let tick = 0; tick < 180; tick++) {
          if (name.includes("moving"))
            for (const [i, c] of cars.entries())
              c.bodyRotation = poseOrientation(
                (tick + i) * 0.01,
                0.1 * Math.sin(tick * 0.01),
                0.1 * Math.cos(tick * 0.01),
              );
          const start = performance.now();
          collectScene(
            entities,
            [],
            world,
            camera,
            camera.getVisibleChunkRange(),
            1,
            terrain,
            [],
            false,
            undefined,
            frame,
          );
          if (tick >= 60) samples.push(performance.now() - start);
          finalStats = { ...frame.receiverStats };
        }
        cases.push({
          name,
          trial,
          mode: current ? "surface-receivers" : "previous-height-ellipse-collection",
          collectionMs: summarize(samples),
          receivers: finalStats,
        });
        frame.clear();
      }
  }
} finally {
  asset.dispose();
}
const report = {
  date: new Date().toISOString(),
  cpu: cpus()[0]?.model,
  platform: `${platform()} ${release()} ${arch()}`,
  scope:
    "Native scene collection only, no GPU, Worker AI, networking or physical-device timing. Alternating lanes; current shared code's immutable-reference collector retains the prior scalar-shadow preparation. Each crowded-roof fixture deliberately includes 32 roof riders, with 64 other nearby actors.",
  cases,
};
const path = process.argv[2] ?? "/tmp/tilefun-217-shadow-preparation.json";
writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
for (const name of [...new Set(cases.map((c) => c.name))])
  for (const mode of [...new Set(cases.map((c) => c.mode))]) {
    const rows = cases.filter((c) => c.name === name && c.mode === mode);
    console.log(
      JSON.stringify({
        name,
        mode,
        mean: rows.reduce((a, b) => a + b.collectionMs.mean, 0) / rows.length,
        p99: rows.map((c) => c.collectionMs.p99),
        receivers: rows[0]?.receivers,
      }),
    );
  }

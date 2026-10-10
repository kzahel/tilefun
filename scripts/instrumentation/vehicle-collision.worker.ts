import {
  type CollisionLane,
  type CollisionScene,
  measureCollisionCase,
} from "../../src/diagnostics/VehicleCollisionBench.js";

self.onmessage = async ({
  data,
}: MessageEvent<{
  scene: CollisionScene;
  vehicles: number;
  lane: CollisionLane;
  samples: number;
}>) => {
  try {
    self.postMessage({
      result: await measureCollisionCase(data.scene, data.vehicles, data.lane, data.samples),
    });
  } catch (error) {
    self.postMessage({ error: String(error) });
  }
};

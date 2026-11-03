import { expect, it } from "vitest";
import { createPlayer } from "../entities/Player.js";
import { createTrain } from "../railway/Train.js";
import { createVehicle } from "../traffic/Vehicle.js";
import { PhysicsScene } from "./PhysicsScene.js";

const ground = {
  getHeight: () => 0,
  getCollision: () => 0,
  queryProps: () => [],
  geometryVersion: () => ({ identity: 1, revision: 0 }),
};
it("keeps ordinary jumps and boosts only a fresh grounded jump near a reachable vehicle roof", async () => {
  for (const target of [
    undefined,
    createVehicle("compact-1", 40, 32),
    createTrain(240, 32),
    createTrain(400, 32),
  ]) {
    const scene = await PhysicsScene.create(),
      p = createPlayer(0, 32);
    p.id = 1;
    if (target) target.id = 2;
    const actors = target ? [p, target] : [p];
    try {
      for (let i = 0; i < 10; i++) {
        scene.synchronize(actors);
        scene.step(new Map(), ground);
      }
      const snapshot = scene.snapshot();
      const input = new Map([[1, { vx: 0, vy: 0, jump: true }]]);
      scene.step(input, ground);
      const initial = scene.bodyState(1)?.vz ?? 0;
      expect(initial).toBeGreaterThan(140);
      if (target && target.position.wx < 300) expect(initial).toBeGreaterThan(160);
      else expect(initial).toBeLessThan(155);
      scene.restore(snapshot);
      scene.step(input, ground);
      expect(scene.bodyState(1)?.vz).toBeCloseTo(initial, 4);
      for (let i = 0; i < 150; i++) {
        scene.synchronize(actors);
        scene.step(input, ground);
      }
      expect(p.wz).toBeLessThan(1);
    } finally {
      scene.dispose();
    }
  }
});

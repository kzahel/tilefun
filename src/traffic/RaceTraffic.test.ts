import { expect, it } from "vitest";
import { racetrackRecipe } from "../scenarios/RoadTrafficRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { required } from "../shared/required.js";
import { samplePath } from "./LaneGraph.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };

it("starts a durable racer grid and keeps every racer lapping its own ring", async () => {
  const s = await ScenarioSession.create(racetrackRecipe());
  try {
    const registry = required(s.realm.vehicleRegistry);
    for (let i = 0; i < 30; i++) await s.step(idle);
    const racers = () =>
      [...required(s.realm.vehicleRegistry).states.values()].filter((v) =>
        v.entity.proceduralId?.endsWith(":racer"),
      );
    expect(racers().length).toBe(8);
    const start = new Map(racers().map((v) => [v.entity.id, { ...v.entity.position }]));
    const lanes = new Map(racers().map((v) => [v.entity.id, v.route?.laneId]));
    let travelled = 0;
    for (let i = 0; i < 600; i++) {
      await s.step(idle);
      for (const v of racers()) {
        const speed = Math.hypot(v.entity.velocity?.vx ?? 0, v.entity.velocity?.vy ?? 0);
        travelled = Math.max(travelled, speed);
      }
    }
    expect(travelled).toBeGreaterThan(100);
    const graph = required(registry.source.trafficNetwork)(0, 0);
    for (const v of racers()) {
      const lane = required(graph.lanes.get(required(v.route?.laneId)));
      expect(lane.race).toBeDefined();
      // Each racer advanced to a later quarter of the SAME ring.
      expect(v.route?.laneId).not.toBe(lanes.get(v.entity.id));
      expect(v.route?.laneId.split(":quarter:")[0]).toBe(
        lanes.get(v.entity.id)?.split(":quarter:")[0],
      );
      const p = required(start.get(v.entity.id));
      expect(Math.hypot(v.entity.position.wx - p.wx, v.entity.position.wy - p.wy)).toBeGreaterThan(
        100,
      );
      // ...and stays on its ring.
      let nearest = Infinity;
      for (let d = 0; d <= lane.path.length; d += 8) {
        const q = samplePath(lane.path, d);
        nearest = Math.min(
          nearest,
          Math.hypot(q.x - v.entity.position.wx, q.y - v.entity.position.wy),
        );
      }
      expect(nearest).toBeLessThan(32);
    }
    await s.reload();
    for (let i = 0; i < 2; i++) await s.step(idle);
    expect(racers().length).toBe(8);
    expect(racers().every((v) => v.autonomous && v.route)).toBe(true);
  } finally {
    await s.close();
  }
}, 60_000);

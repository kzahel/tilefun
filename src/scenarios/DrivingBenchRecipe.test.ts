import { expect, it } from "vitest";
import { required } from "../shared/required.js";
import {
  DRIVING_IDLE,
  DRIVING_INPUT,
  DRIVING_WARMUP_TICKS,
  type DrivingFixture,
  drivingBenchRecipe,
} from "./DrivingBenchRecipe.js";
import { ScenarioSession } from "./ScenarioSession.js";

async function drive(fixture: DrivingFixture) {
  const session = await ScenarioSession.create(drivingBenchRecipe(fixture));
  try {
    const registry = required(session.realm.vehicleRegistry);
    const car = required(session.realm.entityManager.byId.get(required(session.handles.car)));
    await session.command({ kind: "enter-vehicle", entityId: car.id });
    for (let i = 0; i < DRIVING_WARMUP_TICKS; i++) await session.step(DRIVING_IDLE);
    const start = { ...car.position };
    const checkpoints = [];
    for (let i = 0; i < 900; i++) {
      await session.step(DRIVING_INPUT);
      if (i % 60 === 59)
        checkpoints.push(
          Object.entries(session.handles).map(([name, id]) => {
            const e = required(session.realm.entityManager.byId.get(id));
            return { name, x: e.position.wx, y: e.position.wy, z: e.wz, heading: e.vehicleHeading };
          }),
        );
    }
    const count = fixture === "clear" ? 1 : 37;
    expect(registry.states.size).toBe(count);
    expect([...registry.states.values()].filter((v) => v.autonomous)).toHaveLength(
      fixture === "clear" ? 0 : 32,
    );
    expect(session.player.player.parentId).toBe(car.id);
    expect(required(session.realm.collisionDiagnostics).wheelQueries).toBeGreaterThan(0);
    const progress = car.position.wx - start.wx;
    if (fixture === "clear") {
      expect(progress).toBeGreaterThan(1600);
      expect(progress).toBeLessThan(1680);
      expect(Math.abs(car.position.wy - start.wy)).toBeLessThan(0.1);
    } else {
      expect(progress).toBeGreaterThan(100);
      expect(progress).toBeLessThan(400);
      expect(Math.hypot(car.velocity?.vx ?? 0, car.velocity?.vy ?? 0)).toBeLessThan(4);
    }
    // Explicit readiness over a larger area must not populate extra road cars.
    await session.ready({ minCx: -4, maxCx: 4, minCy: -3, maxCy: 3 });
    expect(registry.states.size).toBe(count);
    return checkpoints;
  } finally {
    await session.close();
  }
}

it("repeats the full clear route and backed-up native queue from fresh worlds", async () => {
  for (const fixture of ["clear", "jam"] as const)
    expect(await drive(fixture)).toEqual(await drive(fixture));
});

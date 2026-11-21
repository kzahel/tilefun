import { expect, it } from "vitest";
import { required } from "../shared/required.js";
import { bulldozerYardRecipe } from "./BulldozerYardRecipe.js";
import { ScenarioSession } from "./ScenarioSession.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };

it("moves a parked car at crawl speed and keeps its new position after reload", async () => {
  const session = await ScenarioSession.create(bulldozerYardRecipe());
  const vehicle = (name: string) =>
    required(session.realm.entityManager.byId.get(required(session.handles[name])));
  try {
    for (let tick = 0; tick < 30; tick++) await session.step(idle);
    const dozer = vehicle("car");
    const parked = vehicle("push-car");
    const startX = parked.position.wx;
    session.realm.vehicles.enter(session.player, dozer.id);
    let maxSpeed = 0;
    for (let tick = 0; tick < 240; tick++) {
      await session.step({ ...idle, dx: 1, sprinting: true });
      maxSpeed = Math.max(maxSpeed, Math.abs(dozer.velocity?.vx ?? 0));
    }
    expect(maxSpeed).toBeGreaterThan(40);
    expect(maxSpeed).toBeLessThan(45);
    expect(parked.position.wx - startX).toBeGreaterThan(48);
    expect(Math.abs(parked.position.wy)).toBeLessThan(2);
    expect(Math.abs(parked.wz ?? 0)).toBeLessThan(2);

    for (let tick = 0; tick < 90; tick++) await session.step(idle);
    const pushedX = parked.position.wx;
    await session.reload();
    expect(vehicle("push-car").position.wx).toBeCloseTo(pushedX, 1);
  } finally {
    await session.close();
  }
});

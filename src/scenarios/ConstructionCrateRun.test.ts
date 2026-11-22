import { expect, it } from "vitest";
import { CONSTRUCTION_CRATE } from "../entities/ConstructionCargo.js";
import { CRATE_RUN_CAR } from "../generation/regional/ConstructionYard.js";
import { required } from "../shared/required.js";
import { constructionCrateRunRecipe, constructionYardSite } from "./ConstructionYardRecipe.js";
import { ScenarioSession } from "./ScenarioSession.js";

const idle = { dx: 0, dy: 0, sprinting: false, jump: false };
const forward = { ...idle, dy: -1, relativeDriving: true };

it("lets the racing coupe drive through a settled stack and tumble the crates", async () => {
  const session = await ScenarioSession.create(constructionCrateRunRecipe());
  try {
    for (let i = 0; i < 90; i++) await session.step(idle);
    const yard = constructionYardSite();
    const carStart = required(yard.vehicles.find((v) => v.model === CRATE_RUN_CAR));
    const { entities } = session.realm.entityManager;
    const car = required(entities.find((e) => e.proceduralId === carStart.identity));
    const crates = entities.filter(
      (e) => e.type === CONSTRUCTION_CRATE && e.proceduralId?.startsWith(`${yard.id}:crate:`),
    );
    expect(crates).toHaveLength(9);
    expect(crates.filter((e) => (e.wz ?? 0) > 20)).toHaveLength(2);
    const starts = new Map(crates.map((e) => [e.id, { ...e.position }]));
    const stackX = required(crates[0]).position.wx;

    session.realm.vehicles.enter(session.player, car.id);
    const tumbled = new Set<number>();
    const peaks = new Map<number, number>();
    let passed = false;
    for (let i = 0; i < 215; i++) {
      await session.step(passed ? idle : forward);
      if (car.position.wx > stackX + 55) passed = true;
      for (const crate of crates) {
        const rotation = required(crate.bodyRotation);
        const tilt = Math.hypot(rotation[0], rotation[1]);
        peaks.set(crate.id, Math.max(peaks.get(crate.id) ?? 0, tilt));
        if (tilt > 0.65) tumbled.add(crate.id);
      }
    }
    expect(car.position.wx).toBeGreaterThan(stackX + 50);
    const displacement = crates.map((e) => {
      const start = required(starts.get(e.id));
      return Math.hypot(e.position.wx - start.wx, e.position.wy - start.wy);
    });
    expect(
      tumbled.size,
      JSON.stringify({ tilt: [...peaks.values()], displacement }),
    ).toBeGreaterThanOrEqual(3);
    expect(displacement.filter((distance) => distance > 20).length).toBeGreaterThanOrEqual(6);
  } finally {
    await session.close();
  }
});

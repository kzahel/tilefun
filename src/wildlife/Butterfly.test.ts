import { expect, it } from "vitest";
import { EntityManager } from "../entities/EntityManager.js";
import { durableId } from "../persistence/ActorRecords.js";
import { required } from "../shared/required.js";
import { createFauna } from "./Fauna.js";
import { canEat, creatureSpecies } from "./FoodWeb.js";
import { createPredator } from "./Predator.js";
import { resolvePredatorCatches } from "./predatorAI.js";
import { tickWildlifeRespawns } from "./WildlifeRespawns.js";

it("joins the explicit food web as small spider prey", () => {
  const butterfly = createFauna("butterfly", 64, 64);
  expect(creatureSpecies(butterfly)).toBe("butterfly");
  expect(canEat(createPredator("giant-spider", 48, 64), butterfly)).toBe(true);
  expect(canEat(createPredator("tiger", 48, 64), butterfly)).toBe(false);
});

it.each([false, true])("waits for landing and respects natural lineage: %s", (natural) => {
  const manager = new EntityManager();
  const hunter = manager.spawn(createPredator("giant-spider", 0, 0));
  const butterfly = manager.spawn(createFauna("butterfly", 13, 0));
  const habitat = required(butterfly.fauna);
  habitat.radius = 96;
  habitat.groupId = "butterfly-test-group";
  if (natural) butterfly.naturalSpawnId = "test-natural-butterfly";
  durableId(butterfly);
  Object.assign(required(hunter.predator), {
    state: "pounce",
    elapsed: 0.5,
    targetId: butterfly.persistentId,
  });
  const environment = { canOccupy: () => true, isWater: () => false, surfaceZ: () => 0 };
  butterfly.wz = butterfly.jumpZ = 2;
  resolvePredatorCatches(manager, [...manager.entities], environment, []);
  expect(manager.byId.has(butterfly.id)).toBe(true);
  expect(hunter.predator?.meals).toBe(0);
  butterfly.wz = 0;
  delete butterfly.jumpZ;
  resolvePredatorCatches(manager, [...manager.entities], environment, []);
  expect(manager.byId.has(butterfly.id)).toBe(false);
  expect(hunter.predator?.meals).toBe(1);
  expect(manager.wildlifeRespawns.size).toBe(natural ? 1 : 0);
  tickWildlifeRespawns(manager, 120, environment, []);
  const survivors = manager.entities.filter((e) => e.type === butterfly.type);
  expect(survivors).toHaveLength(natural ? 1 : 0);
  if (natural) {
    expect(survivors[0]?.naturalSpawnId).toBe("test-natural-butterfly");
    expect(survivors[0]?.persistentId).not.toBe(butterfly.persistentId);
    expect(survivors[0]?.fauna?.home).toEqual(survivors[0]?.position);
    expect(survivors[0]?.fauna?.groupId).toBe(habitat.groupId);
  }
});

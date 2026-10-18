import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { EntityManager } from "../entities/EntityManager.js";
import { PropManager } from "../entities/PropManager.js";
import { decodeActor, durableId, encodeActor } from "../persistence/ActorRecords.js";
import { createFauna } from "./Fauna.js";
import { canEat, creatureSpecies } from "./FoodWeb.js";
import { updateFaunaAI } from "./faunaAI.js";
import { createPredator } from "./Predator.js";
import { resolvePredatorCatches } from "./predatorAI.js";

it("flies a short physical arc, restores its airborne pose, and lands on the target", () => {
  const manager = new EntityManager();
  const props = new PropManager();
  const butterfly = manager.spawn(createFauna("butterfly", 64, 64));
  required(butterfly.fauna).timer = 0;
  updateFaunaAI(
    butterfly,
    0.1,
    { canOccupy: () => true, isWater: () => false, surfaceZ: () => 0 },
    [butterfly],
    [],
  );
  const target = { ...required(butterfly.fauna).target };
  manager.update(
    0.32,
    () => 0,
    [],
    props,
    undefined,
    () => 0,
  );
  expect(butterfly.wz).toBeCloseTo(6, 5);
  expect(butterfly.position.wx).toBeCloseTo((64 + target.wx) / 2, 5);
  expect(butterfly.position.wy).toBeCloseTo((64 + target.wy) / 2, 5);
  expect(butterfly.sprite?.frameCol).toBe(17);
  const restored = decodeActor(encodeActor(butterfly));
  if ("isProp" in restored) throw Error("Expected butterfly");
  const other = new EntityManager();
  other.spawn(restored);
  for (let i = 0; i < 60; i++) {
    manager.update(
      1 / 60,
      () => 0,
      [],
      props,
      undefined,
      () => 0,
    );
    other.update(
      1 / 60,
      () => 0,
      [],
      props,
      undefined,
      () => 0,
    );
    expect(restored.position).toEqual(butterfly.position);
    expect(restored.wz).toBe(butterfly.wz);
    expect(restored.fauna).toEqual(butterfly.fauna);
  }
  expect(butterfly.position.wx).toBeCloseTo(target.wx, 5);
  expect(butterfly.position.wy).toBeCloseTo(target.wy, 5);
  expect(butterfly.wz).toBe(0);
  expect(butterfly.jumpZ).toBeUndefined();
  expect(butterfly.fauna?.state).toBe("rest");
});

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
  const survivors = manager.entities.filter((e) => e.type === butterfly.type);
  expect(survivors).toHaveLength(natural ? 1 : 0);
  if (natural) {
    expect(survivors[0]?.naturalSpawnId).toBe("test-natural-butterfly");
    expect(survivors[0]?.persistentId).not.toBe(butterfly.persistentId);
    expect(survivors[0]?.fauna?.home).toEqual(habitat.home);
    expect(survivors[0]?.fauna?.groupId).toBe(habitat.groupId);
  }
});

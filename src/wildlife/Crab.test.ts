import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { Direction } from "../entities/Entity.js";
import { EntityManager } from "../entities/EntityManager.js";
import { PropManager } from "../entities/PropManager.js";
import { decodeActor, encodeActor } from "../persistence/ActorRecords.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import { createFauna } from "./Fauna.js";
import { canEat } from "./FoodWeb.js";
import { restoreFaunaPose } from "./faunaInteractions.js";
import { createPredator } from "./Predator.js";

it.each([
  [32, 0, Direction.Up],
  [0, 32, Direction.Right],
  [-32, 0, Direction.Down],
  [0, -32, Direction.Left],
])("keeps the sideways scuttle aligned with actual travel and reload: %s,%s", (dx, dy, facing) => {
  const manager = new EntityManager(),
    props = new PropManager();
  const crab = manager.spawn(createFauna("crab", 128, 128));
  const ai = required(crab.fauna);
  ai.target = { wx: 128 + dx, wy: 128 + dy };
  ai.state = "travel";
  ai.motion = { elapsed: 0, duration: 5, escaping: false };
  restoreFaunaPose(crab);
  expect(crab.sprite?.direction).toBe(facing);
  manager.update(
    0.24,
    () => CollisionFlag.Water,
    [],
    props,
    undefined,
    () => 0,
  );
  expect(crab.position.wx).toBeCloseTo(128 + (dx / 32) * 1.6, 5);
  expect(crab.position.wy).toBeCloseTo(128 + (dy / 32) * 1.6, 5);
  expect(crab.sprite?.frameCol).toBe(9);
  expect(crab.sprite?.frameRow).toBe(facing);
  const restored = decodeActor(encodeActor(crab));
  if ("isProp" in restored) throw Error("Expected crab");
  const other = new EntityManager();
  other.spawn(restored);
  for (let i = 0; i < 20; i++) {
    manager.update(
      1 / 60,
      () => CollisionFlag.Water,
      [],
      props,
      undefined,
      () => 0,
    );
    other.update(
      1 / 60,
      () => CollisionFlag.Water,
      [],
      props,
      undefined,
      () => 0,
    );
    expect(restored.position).toEqual(crab.position);
    expect(restored.sprite).toEqual(crab.sprite);
  }
});

it("makes the aquatic crab explicit bear prey without adding land-cat meals", () => {
  const crab = createFauna("crab", 128, 128);
  expect(canEat(createPredator("brown-bear", 128, 128), crab)).toBe(true);
  expect(canEat(createPredator("tiger", 128, 128), crab)).toBe(false);
});

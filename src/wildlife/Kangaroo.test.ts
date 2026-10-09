import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { EntityManager } from "../entities/EntityManager.js";
import { createProp } from "../entities/PropFactories.js";
import { PropManager } from "../entities/PropManager.js";
import { decodeActor, encodeActor } from "../persistence/ActorRecords.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import { createFauna } from "./Fauna.js";
import { updateFaunaAI } from "./faunaAI.js";
import { startleFauna } from "./faunaInteractions.js";

const open = { canOccupy: () => true, isWater: () => false, surfaceZ: () => 0 };
const tick = (m: EntityManager, p: PropManager, dt: number) =>
  m.update(
    dt,
    () => 0,
    [],
    p,
    undefined,
    () => 0,
  );
it("kangaroo push, flight and native landing own height, XY and saved phase", () => {
  const manager = new EntityManager(),
    props = new PropManager(),
    k = manager.spawn(createFauna("kangaroo", 64, 64));
  required(k.fauna).timer = 0;
  updateFaunaAI(k, 0.1, open, [k], []);
  const target = { ...required(k.fauna).target };
  tick(manager, props, 0.4);
  expect(k.position).toEqual({ wx: 64, wy: 64 });
  expect(k.wz).toBe(0);
  tick(manager, props, 0.4);
  expect(k.wz).toBeCloseTo(Math.sin(Math.PI / 3) * 16, 5);
  expect(k.position.wx).toBeCloseTo(64 + (target.wx - 64) / 3, 5);
  expect(k.position.wy).toBeCloseTo(64 + (target.wy - 64) / 3, 5);
  expect(k.sprite?.clipElapsedMs).toBe(800);
  expect(k.sprite?.frameCol).toBe(6);
  const replica = deserializeEntity(serializeEntity(k));
  expect(replica.wz).toBeCloseTo(required(k.wz), 5);
  expect(replica.sprite?.frameCol).toBe(6);
  const restored = decodeActor(encodeActor(k));
  if ("isProp" in restored) throw Error("Expected kangaroo");
  const other = new EntityManager();
  other.spawn(restored);
  for (let i = 0; i < 60; i++) {
    tick(manager, props, 1 / 60);
    tick(other, props, 1 / 60);
    expect(restored.position).toEqual(k.position);
    expect(restored.wz).toBe(k.wz);
    expect(restored.fauna).toEqual(k.fauna);
  }
  expect(k.position.wx).toBeCloseTo(target.wx, 5);
  expect(k.position.wy).toBeCloseTo(target.wy, 5);
  expect(k.wz).toBe(0);
  expect(k.jumpZ).toBeUndefined();
  expect(k.jumpVZ).toBeUndefined();
  expect(k.fauna?.state).toBe("rest");
});
it("a kangaroo alarm preserves a committed hop, then makes one faster physical escape", () => {
  const manager = new EntityManager(),
    props = new PropManager(),
    k = manager.spawn(createFauna("kangaroo", 64, 64));
  required(k.fauna).timer = 0;
  updateFaunaAI(k, 0.1, open, [k], []);
  tick(manager, props, 0.8);
  const saved = JSON.stringify(k.fauna?.motion);
  startleFauna(k, { wx: 40, wy: 64 });
  expect(JSON.stringify(k.fauna?.motion)).toBe(saved);
  tick(manager, props, 0.8);
  expect(k.fauna?.state).toBe("startle");
  expect(k.wz).toBe(0);
  updateFaunaAI(k, 0.5, open, [k], []);
  expect(k.fauna?.motion?.duration).toBe(0.8);
  expect(k.sprite?.clip).toBe(3);
  tick(manager, props, 0.4);
  expect(k.wz).toBeGreaterThan(10);
  expect(k.sprite?.clipElapsedMs).toBe(400);
  expect(startleFauna(k, { wx: 0, wy: 0 })).toBe(false);
  tick(manager, props, 0.4);
  expect(k.fauna?.state).toBe("recover");
  expect(k.wz).toBe(0);
  expect(k.jumpVZ).toBeUndefined();
});
it("an edited tree can block a kangaroo hop without forcing arrival through its trunk", () => {
  const manager = new EntityManager(),
    props = new PropManager(),
    k = manager.spawn(createFauna("kangaroo", 64, 64));
  required(k.fauna).timer = 0;
  updateFaunaAI(k, 0.1, open, [k], []);
  const target = { ...required(k.fauna).target };
  props.add(createProp("prop-oak-tree", 64 + (target.wx - 64) * 0.6, 64 + (target.wy - 64) * 0.6));
  for (let i = 0; i < 110; i++) tick(manager, props, 1 / 60);
  expect(Math.hypot(k.position.wx - target.wx, k.position.wy - target.wy)).toBeGreaterThan(1);
  expect(k.fauna?.state).toBe("rest");
  expect(k.fauna?.motion).toBeUndefined();
  expect(k.jumpZ).toBeUndefined();
});

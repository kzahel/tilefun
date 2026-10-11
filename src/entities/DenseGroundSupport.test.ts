import { afterEach, describe, expect, it, vi } from "vitest";
import { CHUNK_SIZE_PX } from "../config/constants.js";
import { encodeActor } from "../persistence/ActorRecords.js";
import * as surfaceHeight from "../physics/surfaceHeight.js";
import { createTrain } from "../railway/Train.js";
import { surfaceProp } from "../scenarios/WorldGeometryRecipe.js";
import { createVehicle } from "../traffic/Vehicle.js";
import { getEntityAABB } from "./collision.js";
import type { Entity } from "./Entity.js";
import { EntityManager } from "./EntityManager.js";
import { createPlayer } from "./Player.js";
import { PropManager } from "./PropManager.js";

function body(manager: EntityManager, x: number, y: number, z = 0): Entity {
  const e = createPlayer(x, y);
  e.velocity = null;
  e.wz = z;
  e.collider = { offsetX: 0, offsetY: 0, width: 8, height: 8, physicalHeight: 4 };
  manager.spawn(e);
  e.persistentId = `fixture-${e.id}`;
  return e;
}
function crowd(manager: EntityManager): Entity[] {
  return Array.from({ length: 32 }, (_, i) => {
    const e = body(manager, 40 + (i % 16) * 10, 180 + Math.floor(i / 16) * 20);
    if (e.collider) e.collider.width = e.collider.height = 2;
    return e;
  });
}
const step = (manager: EntityManager, props = new PropManager(), active?: Map<Entity, number>) =>
  manager.update(
    1 / 60,
    () => 0,
    [],
    props,
    active,
    () => 0,
  );
afterEach(() => vi.restoreAllMocks());

describe("dense ground support", () => {
  it("narrows support lists after movement while retaining per-range prop reuse", () => {
    const manager = new EntityManager();
    crowd(manager);
    body(manager, 40, 40);
    body(manager, 80, 80);
    const props = new PropManager();
    const propQuery = vi.spyOn(props, "getPropsInChunkRange");
    const coarse = vi.spyOn(manager.spatialHash, "queryRange");
    const fine = vi.spyOn(manager.collisionIndex, "query");
    step(manager, props);
    expect(coarse).not.toHaveBeenCalled();
    expect(propQuery).toHaveBeenCalledTimes(1);
    expect(fine).toHaveBeenCalledTimes(34);
    expect(Math.max(...fine.mock.results.map((r) => r.value.length))).toBeLessThan(10);
  });

  it("reads earlier terrain/support snaps live rather than caching resolved heights", () => {
    const manager = new EntityManager();
    const support = body(manager, 80, 80);
    const rider = body(manager, 80, 80, 12);
    crowd(manager);
    manager.update(
      1 / 60,
      () => 0,
      [],
      new PropManager(),
      undefined,
      () => 1,
    );
    expect(support.wz).toBe(8);
    expect(rider.groundZ).toBe(12);
    expect(rider.wz).toBe(12);
  });

  it.each([0, -1, 9])("keeps the step threshold for a rider at height %i", (z) => {
    const manager = new EntityManager();
    const support = body(manager, 80, 80);
    const rider = body(manager, 80, 80, z);
    const active = new Map(crowd(manager).map((e) => [e, 1 / 60]));
    active.set(rider, 1 / 60); // support is asleep, and retains its original Z
    step(manager, undefined, active);
    expect(rider.groundZ).toBe(z === 0 ? 4 : 0);
    expect(support.wz).toBe(0);
  });

  it("refreshes sleeping support teleports, shapes, solidity, removal and restore", () => {
    const manager = new EntityManager();
    const support = body(manager, -260, -260);
    const rider = body(manager, -260, -260, 4);
    const active = new Map(crowd(manager).map((e) => [e, 1 / 60]));
    active.set(rider, 1 / 60);
    const read = () => {
      rider.wz = 4;
      step(manager, undefined, active);
      return rider.groundZ;
    };
    expect(read()).toBe(4);
    // No coarse-index refresh: the dense snapshot rebuild reads resident geometry.
    support.position.wx = -600;
    expect(read()).toBe(0);
    if (!support.collider) throw Error("Expected support collider");
    support.collider.width = 100_000;
    support.collider.height = 100_000;
    expect(read()).toBe(4); // oversized and across a negative chunk boundary
    support.collider.solid = false;
    expect(read()).toBe(0);
    support.collider.solid = true;
    manager.remove(support.id);
    expect(read()).toBe(0);
    manager.restore(support);
    expect(read()).toBe(4);
  });

  it("sees a moving support at its new footprint across fine and chunk seams", () => {
    const manager = new EntityManager();
    const roof = body(manager, 20, 40);
    roof.velocity = { vx: 240, vy: 0 };
    const rider = body(manager, 260, 40, 4);
    crowd(manager);
    manager.update(
      1,
      () => 0,
      [],
      new PropManager(),
      undefined,
      () => 0,
    );
    expect(roof.position.wx).toBe(260);
    expect(rider.groundZ).toBe(4);
  });

  it.each(["vehicle", "train"])("keeps the real %s roof bounds and height", (kind) => {
    const manager = new EntityManager();
    const roof = manager.spawn(
      kind === "vehicle" ? createVehicle("bus-1", 80, 80) : createTrain(80, 80),
    );
    roof.velocity = null;
    roof.wz = 0;
    if (!roof.collider) throw Error("Expected roof collider");
    const bounds = getEntityAABB(roof.position, roof.collider);
    const top = roof.collider.physicalHeight ?? 0;
    const rider = body(manager, (bounds.left + bounds.right) / 2, bounds.bottom - 2, top);
    const active = new Map(crowd(manager).map((e) => [e, 1 / 60]));
    active.set(rider, 1 / 60);
    step(manager, undefined, active);
    expect(rider.groundZ).toBe(top);
  });

  it("updates ground under an airborne actor without snapping its jump height", () => {
    const manager = new EntityManager();
    body(manager, 80, 80);
    const jumper = body(manager, 80, 80, 4);
    jumper.jumpVZ = 24;
    jumper.jumpZ = 4;
    const active = new Map(crowd(manager).map((e) => [e, 1 / 60]));
    active.set(jumper, 1 / 60);
    step(manager, undefined, active);
    expect(jumper.groundZ).toBe(4);
    expect(jumper.wz).toBe(4);
    expect(jumper.jumpVZ).toBe(24);
    expect(jumper.jumpZ).toBe(4);
  });

  it("preserves excavated prop surfaces and skipped/parented support bodies", () => {
    const manager = new EntityManager();
    const rider = body(manager, 80, 80, -8);
    const props = new PropManager();
    props.add(
      surfaceProp(
        { left: 64, right: 96, top: 64, bottom: 96 },
        {
          id: "floor",
          spaceId: "cut",
          z: -8,
          riseX: 0,
          riseY: 0,
          thickness: 4,
          connectsTo: [],
          excavation: {},
        },
      ),
    );
    crowd(manager);
    step(manager, props);
    expect(rider.groundZ).toBe(-8);
    const parent = body(manager, 80, 80, -8);
    const child = body(manager, 80, 80, -8);
    child.parentId = parent.id;
    rider.wz = -4;
    manager.update(
      1 / 60,
      () => 0,
      [],
      props,
      undefined,
      () => 0,
      new Set([parent.id]),
    );
    expect(rider.groundZ).toBe(-4);
  });

  it("matches all-resident support resolution for varied footprints, offsets and heights", () => {
    const manager = new EntityManager();
    crowd(manager);
    let seed = 2026;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    for (let i = 0; i < 100; i++) {
      const e = body(manager, (random() - 0.5) * 600, (random() - 0.5) * 600, random() * 30);
      if (!e.collider) throw Error("Expected test collider");
      e.collider.width = 8 + random() * 240;
      e.collider.height = 8 + random() * 160;
      e.collider.offsetX = (random() - 0.5) * 600;
      e.collider.offsetY = (random() - 0.5) * 600;
      e.collider.physicalHeight = random() * 30;
      e.collider.solid = i % 7 !== 0;
      if (i % 11 === 0) e.collider = null;
    }
    const original = surfaceHeight.resolveGroundZForTracking;
    const resolver = vi
      .spyOn(surfaceHeight, "resolveGroundZForTracking")
      .mockImplementation((e, h, p, nearby) => {
        const actual = original(e, h, p, nearby);
        expect(actual).toBe(original(e, h, p, manager.entities));
        return actual;
      });
    manager.update(
      1 / 60,
      () => 0,
      [],
      new PropManager(),
      undefined,
      (x, y) => Math.abs(x + y) % 3,
    );
    expect(resolver).toHaveBeenCalledTimes(manager.entities.length);
  });

  it("matches legacy ground queries across repeated live edits and durable frames", () => {
    const run = (legacy: boolean) => {
      const manager = new EntityManager();
      const support = body(manager, 80, 80);
      const rider = body(manager, 80, 80, 4);
      crowd(manager);
      const props = new PropManager();
      const original = surfaceHeight.resolveGroundZForTracking;
      if (legacy)
        vi.spyOn(surfaceHeight, "resolveGroundZForTracking").mockImplementation((e, h, p) => {
          const b = e.collider ? getEntityAABB(e.position, e.collider) : null;
          return original(
            e,
            h,
            p,
            manager.spatialHash.queryRange(
              Math.floor((b?.left ?? e.position.wx) / CHUNK_SIZE_PX),
              Math.floor((b?.top ?? e.position.wy) / CHUNK_SIZE_PX),
              Math.floor((b?.right ?? e.position.wx) / CHUNK_SIZE_PX),
              Math.floor((b?.bottom ?? e.position.wy) / CHUNK_SIZE_PX),
            ),
          );
        });
      const frames = [];
      for (let i = 0; i < 40; i++) {
        rider.wz = 4;
        if (!support.collider) throw Error("Expected support");
        support.collider.solid = i % 3 !== 0;
        support.position.wx = i % 2 ? 80 : 120;
        manager.spatialHash.update(support);
        step(manager, props);
        frames.push({
          live: structuredClone(manager.entities),
          saved: manager.entities.map((e) => encodeActor(e)),
        });
      }
      vi.restoreAllMocks();
      return frames;
    };
    expect(run(false)).toEqual(run(true));
  });
});

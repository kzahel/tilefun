import { describe, expect, it, vi } from "vitest";
import { TerrainId } from "../autotile/TerrainId.js";
import { encodeActor } from "../persistence/ActorRecords.js";
import { clipAirMomentum } from "../physics/AirborneMomentum.js";
import { tickAllAI } from "../server/tickAllAI.js";
import { createFauna } from "../wildlife/Fauna.js";
import { createFrog } from "../wildlife/Frog.js";
import { createRobin } from "../wildlife/Robin.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import { createChicken } from "./Chicken.js";
import * as collision from "./collision.js";
import { type AABB, aabbOverlapsSolid, getEntityAABB, resolveCollision } from "./collision.js";
import type { Entity, PositionComponent } from "./Entity.js";
import { EntityManager } from "./EntityManager.js";
import { createPlayer } from "./Player.js";
import { PropManager } from "./PropManager.js";

// Frozen pre-optimization axis policy (64829c0), independent of the new branch.
function referenceResolveCollision(
  entity: Entity,
  dx: number,
  dy: number,
  getCollision: (tx: number, ty: number) => number,
  blockMask: number,
  isExtraBlocked?: (aabb: AABB) => boolean,
): boolean {
  if (!entity.collider) {
    entity.position.wx += dx;
    entity.position.wy += dy;
    return false;
  }

  let blocked = false;

  // Try X axis
  const testX: PositionComponent = {
    wx: entity.position.wx + dx,
    wy: entity.position.wy,
  };
  const xBox = getEntityAABB(testX, entity.collider);
  if (!aabbOverlapsSolid(xBox, getCollision, blockMask) && !isExtraBlocked?.(xBox)) {
    entity.position.wx = testX.wx;
  } else {
    clipAirMomentum(entity, "x");
    blocked = true;
  }

  // Try Y axis (using updated X position)
  const testY: PositionComponent = {
    wx: entity.position.wx,
    wy: entity.position.wy + dy,
  };
  const yBox = getEntityAABB(testY, entity.collider);
  if (!aabbOverlapsSolid(yBox, getCollision, blockMask) && !isExtraBlocked?.(yBox)) {
    entity.position.wy = testY.wy;
  } else {
    clipAirMomentum(entity, "y");
    blocked = true;
  }

  return blocked;
}

describe("identical collision probe reuse", () => {
  it.each([
    { dx: 0, dy: 0, blocked: false, queries: 1 },
    { dx: 0, dy: 0, blocked: true, queries: 1 },
    { dx: 2, dy: 0, blocked: false, queries: 1 },
    { dx: 2, dy: 0, blocked: true, queries: 2 },
    { dx: 0, dy: 2, blocked: false, queries: 2 },
    { dx: 2, dy: 2, blocked: false, queries: 2 },
  ])(
    "retains axis outcomes and queries only distinct poses: $dx/$dy/$blocked",
    ({ dx, dy, blocked, queries }) => {
      const initial = createPlayer(24, 24);
      initial.airMomentumX = 11;
      initial.airMomentumY = -7;
      initial.velocity = { vx: 11, vy: -7 };
      const original = structuredClone(initial);
      const optimized = structuredClone(initial);
      const predicate = vi.fn(() => blocked);
      const expected = referenceResolveCollision(
        original,
        dx,
        dy,
        () => 0,
        CollisionFlag.Solid,
        () => blocked,
      );
      expect(
        resolveCollision(optimized, dx, dy, () => 0, CollisionFlag.Solid, predicate, true),
      ).toBe(expected);
      expect(optimized).toEqual(original);
      expect(predicate).toHaveBeenCalledTimes(queries);
    },
  );

  it("keeps stateful callbacks and both axis clips for callers that do not opt in", () => {
    const e = createPlayer(24, 24);
    e.airMomentumX = 11;
    e.airMomentumY = -7;
    const extra = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    expect(resolveCollision(e, 0, 0, () => 0, CollisionFlag.Solid, extra)).toBe(true);
    expect(extra).toHaveBeenCalledTimes(2);
    expect(e.airMomentumX).toBe(11);
    expect(e.airMomentumY).toBe(0);
  });

  it("matches the original across 4,096 deterministic footprints, masks, obstacles and air states", () => {
    let state = 2026;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state;
    };
    const displacements = [0, -0, -3.2, 3.2, -16, 16];
    for (let i = 0; i < 4096; i++) {
      const e = createPlayer(((random() % 400) - 200) / 4, ((random() % 400) - 200) / 4);
      if (e.collider) {
        e.collider.width = 1 + (random() % 35);
        e.collider.height = 1 + (random() % 27);
        e.collider.offsetX = (random() % 9) - 4;
      }
      if (i % 7 === 0) e.collider = null;
      e.velocity = { vx: (random() % 80) - 40, vy: (random() % 80) - 40 };
      if (i % 3 === 0) {
        e.airMomentumX = e.velocity.vx;
        e.airMomentumY = e.velocity.vy;
        e.jumpVZ = 20;
        e.wz = 9;
      }
      const dx = displacements[random() % displacements.length] ?? 0;
      const dy = displacements[random() % displacements.length] ?? 0;
      const seed = random();
      const tile = (tx: number, ty: number) => {
        const value = (Math.imul(tx, 73856093) ^ Math.imul(ty, 19349663) ^ seed) >>> 0;
        return value % 5 === 0 ? CollisionFlag.Solid : value % 3 === 0 ? CollisionFlag.Water : 0;
      };
      const mask = i % 2 ? CollisionFlag.Solid : CollisionFlag.Solid | CollisionFlag.Water;
      const obstacle: AABB = { left: -12, right: 18, top: -14, bottom: 24 };
      const extra = i % 4 === 0 ? undefined : (box: AABB) => collision.aabbsOverlap(box, obstacle);
      const original = structuredClone(e);
      const optimized = structuredClone(e);
      const expected = referenceResolveCollision(original, dx, dy, tile, mask, extra);
      expect(resolveCollision(optimized, dx, dy, tile, mask, extra, true), `case ${i}`).toBe(
        expected,
      );
      expect(optimized, `case ${i}`).toEqual(original);
    }
  });

  it("matches live AI/RNG, water/deep-water/elevation, props, contacts, attachments and saved state", () => {
    const run = () => {
      const manager = new EntityManager();
      const props = new PropManager();
      const player = manager.spawn(createPlayer(40, 44));
      const horse = createFauna("horse", 48, 90);
      const actors = [
        createChicken(24, 24),
        createChicken(26, 24),
        createChicken(256, 24),
        createRobin(72, 40),
        createFrog(112, 36),
        createFauna("dog", 48, 44),
        createFauna("kangaroo", 76, 76),
        createFauna("fish", 136, 40),
        createFauna("penguin", 108, 64),
        createFauna("manta-ray", 164, 60),
        horse,
      ];
      for (const e of actors) manager.spawn(e);
      const mounted = manager.spawn(createPlayer(48, 90));
      mounted.parentId = horse.id;
      mounted.localOffsetX = 1;
      mounted.localOffsetY = -1;
      mounted.jumpZ = 18;
      for (const e of manager.entities) e.persistentId = `fixture-${e.id}`;
      props.add({
        id: 0,
        type: "fixture-wall",
        position: { wx: 24, wy: 24 },
        isProp: true,
        sprite: { sheetKey: "", frameCol: 0, frameRow: 0, spriteWidth: 16, spriteHeight: 16 },
        walls: null,
        collider: { offsetX: 0, offsetY: 0, width: 10, height: 6, zHeight: 12 },
      });
      const tile = (tx: number, ty: number) =>
        tx < 0 || ty < 0 || tx === 16 ? CollisionFlag.Solid : tx >= 7 ? CollisionFlag.Water : 0;
      const height = (tx: number, ty: number) => (tx === 5 && ty >= 4 ? 2 : 0);
      const terrain = (tx: number) => (tx >= 9 ? TerrainId.DeepWater : TerrainId.ShallowWater);
      let rng = 2026;
      const draws: number[] = [];
      const random = () => {
        rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
        draws.push(rng);
        return rng / 4294967296;
      };
      const frames = [];
      for (let step = 0; step < 180; step++) {
        // Exercise live prop edits and changed bodies on later calls: no cross-call cache.
        if (step === 30) props.move(1, 38, 24);
        if (step === 60) props.remove(1);
        if (step === 90 && actors[0]?.collider) actors[0].collider.width = 18;
        const active = new Map(
          manager.entities.filter((e) => e !== actors[2]).map((e) => [e, 1 / 60]),
        );
        tickAllAI(
          manager.entities,
          [player.position],
          active,
          random,
          {
            perches: () => [],
            surfaceZ: (p) => height(Math.floor(p.wx / 16), Math.floor(p.wy / 16)) * 8,
            isWater: (p) =>
              !!(tile(Math.floor(p.wx / 16), Math.floor(p.wy / 16)) & CollisionFlag.Water),
            isDeepWater: (p) => Math.floor(p.wx / 16) >= 9,
            canOccupy: () => true,
          },
          step,
        );
        manager.update(1 / 60, tile, [player, mounted], props, active, height, undefined, terrain);
        frames.push({
          live: structuredClone(manager.entities),
          saved: manager.entities.map((e) => encodeActor(e, manager.byId.get(e.parentId ?? -1))),
          rng,
        });
      }
      return { frames, draws };
    };
    const spy = vi
      .spyOn(collision, "resolveCollision")
      .mockImplementation(referenceResolveCollision);
    let expected: ReturnType<typeof run>;
    try {
      expected = run();
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls.some((args) => args[6] === true)).toBe(true);
    } finally {
      spy.mockRestore();
    }
    expect(run()).toEqual(expected);
  });
});

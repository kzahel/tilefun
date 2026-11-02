import { describe, expect, it, vi } from "vitest";
import { clipAirMomentum } from "../physics/AirborneMomentum.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import * as collision from "./collision.js";
import { type AABB, aabbOverlapsSolid, getEntityAABB, resolveCollision } from "./collision.js";
import type { Entity, PositionComponent } from "./Entity.js";
import { createPlayer } from "./Player.js";

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
});

import { describe, expect, it } from "vitest";
import { CollisionFlag } from "../world/TileRegistry.js";
import { aabbOverlapsSolid, getEntityAABB } from "./collision.js";

function makeCollisionGrid(grid: Record<string, number>): (tx: number, ty: number) => number {
  return (tx, ty) => grid[`${tx},${ty}`] ?? CollisionFlag.None;
}

describe("getEntityAABB", () => {
  it("computes correct AABB from position and collider", () => {
    const aabb = getEntityAABB(
      { wx: 100, wy: 200 },
      { offsetX: 0, offsetY: 0, width: 10, height: 6 },
    );
    expect(aabb.left).toBe(95);
    expect(aabb.right).toBe(105);
    expect(aabb.top).toBe(194);
    expect(aabb.bottom).toBe(200);
  });

  it("handles offset collider", () => {
    const aabb = getEntityAABB(
      { wx: 50, wy: 50 },
      { offsetX: 4, offsetY: -2, width: 8, height: 4 },
    );
    expect(aabb.left).toBe(50);
    expect(aabb.right).toBe(58);
    expect(aabb.top).toBe(44);
    expect(aabb.bottom).toBe(48);
  });
});

describe("aabbOverlapsSolid", () => {
  it("returns false when all tiles are passable", () => {
    const check = makeCollisionGrid({});
    const result = aabbOverlapsSolid(
      { left: 10, top: 10, right: 20, bottom: 20 },
      check,
      CollisionFlag.Solid | CollisionFlag.Water,
    );
    expect(result).toBe(false);
  });

  it("returns true when AABB overlaps a solid tile", () => {
    const check = makeCollisionGrid({ "1,1": CollisionFlag.Solid });
    const result = aabbOverlapsSolid(
      { left: 20, top: 20, right: 28, bottom: 28 },
      check,
      CollisionFlag.Solid,
    );
    expect(result).toBe(true);
  });

  it("returns true when AABB overlaps a water tile with Water mask", () => {
    const check = makeCollisionGrid({ "0,0": CollisionFlag.Water });
    const result = aabbOverlapsSolid(
      { left: 0, top: 0, right: 10, bottom: 10 },
      check,
      CollisionFlag.Water,
    );
    expect(result).toBe(true);
  });

  it("returns false for SlowWalk tile when mask is Solid|Water", () => {
    const check = makeCollisionGrid({ "0,0": CollisionFlag.SlowWalk });
    const result = aabbOverlapsSolid(
      { left: 0, top: 0, right: 10, bottom: 10 },
      check,
      CollisionFlag.Solid | CollisionFlag.Water,
    );
    expect(result).toBe(false);
  });

  it("handles AABB spanning multiple tiles", () => {
    // AABB spans tiles (0,0) through (2,2) — only (2,1) is solid
    const check = makeCollisionGrid({ "2,1": CollisionFlag.Solid });
    const result = aabbOverlapsSolid(
      { left: 0, top: 0, right: 40, bottom: 40 },
      check,
      CollisionFlag.Solid,
    );
    expect(result).toBe(true);
  });

  it("handles negative world coordinates", () => {
    // Tile at (-1, -1) = world coords (-16..-1, -16..-1)
    const check = makeCollisionGrid({ "-1,-1": CollisionFlag.Water });
    const result = aabbOverlapsSolid(
      { left: -10, top: -10, right: -2, bottom: -2 },
      check,
      CollisionFlag.Water,
    );
    expect(result).toBe(true);
  });
});

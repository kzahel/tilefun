import { describe, expect, it } from "vitest";
import { ELEVATION_PX, STEP_UP_THRESHOLD, TILE_SIZE } from "../config/constants.js";
import {
  applyGroundTracking,
  getEffectiveGroundZ,
  getMaxSurfaceZUnderAABB,
  getSurfaceZ,
  isElevationBlocked3D,
  resolveGroundZForLanding,
  resolveGroundZForTracking,
} from "./surfaceHeight.js";

/** Create a getHeight function from a sparse tile→height map. */
function heightMap(map: Record<string, number>): (tx: number, ty: number) => number {
  return (tx, ty) => map[`${tx},${ty}`] ?? 0;
}

describe("getSurfaceZ", () => {
  it("returns 0 for flat terrain", () => {
    expect(getSurfaceZ(100, 100, () => 0)).toBe(0);
  });

  it("returns height * ELEVATION_PX for elevated terrain", () => {
    const getHeight = heightMap({ "6,6": 2 });
    // wx=100, wy=100 → tx=6, ty=6
    expect(getSurfaceZ(100, 100, getHeight)).toBe(2 * ELEVATION_PX);
  });

  it("returns correct value at tile boundary", () => {
    const getHeight = heightMap({ "1,0": 3 });
    // wx=16 → tx=1 (exactly on tile boundary)
    expect(getSurfaceZ(16, 0, getHeight)).toBe(3 * ELEVATION_PX);
    // wx=15.999 → tx=0
    expect(getSurfaceZ(15.999, 0, getHeight)).toBe(0);
  });
});

describe("getMaxSurfaceZUnderAABB", () => {
  it("returns height for AABB within one tile", () => {
    const getHeight = heightMap({ "6,6": 2 });
    const aabb = { left: 97, top: 97, right: 103, bottom: 103 };
    expect(getMaxSurfaceZUnderAABB(aabb, getHeight)).toBe(2 * ELEVATION_PX);
  });

  it("returns max height when AABB straddles two tiles", () => {
    // Tile (0,0) at height 0, tile (1,0) at height 2
    const getHeight = heightMap({ "1,0": 2 });
    // AABB straddles the boundary at x=16
    const aabb = { left: 12, top: 4, right: 20, bottom: 12 };
    expect(getMaxSurfaceZUnderAABB(aabb, getHeight)).toBe(2 * ELEVATION_PX);
  });

  it("returns 0 when all tiles under AABB are flat", () => {
    const aabb = { left: 10, top: 10, right: 20, bottom: 20 };
    expect(getMaxSurfaceZUnderAABB(aabb, () => 0)).toBe(0);
  });

  it("handles AABB spanning multiple tiles", () => {
    // 3x3 tile area, center tile is highest
    const getHeight = heightMap({ "1,1": 3, "0,1": 1, "2,1": 1 });
    const aabb = {
      left: 0,
      top: TILE_SIZE,
      right: 3 * TILE_SIZE - 0.001,
      bottom: 2 * TILE_SIZE - 0.001,
    };
    expect(getMaxSurfaceZUnderAABB(aabb, getHeight)).toBe(3 * ELEVATION_PX);
  });

  it("handles AABB at chunk boundary", () => {
    // Chunk boundary at tile 16. Tile 15 at height 1, tile 16 at height 2.
    const getHeight = heightMap({ "15,0": 1, "16,0": 2 });
    const aabb = {
      left: 15 * TILE_SIZE + 10,
      top: 2,
      right: 16 * TILE_SIZE + 6,
      bottom: 10,
    };
    expect(getMaxSurfaceZUnderAABB(aabb, getHeight)).toBe(2 * ELEVATION_PX);
  });
});

describe("isElevationBlocked3D", () => {
  it("blocks when surface is higher than entity wz", () => {
    const getHeight = heightMap({ "1,0": 2 });
    const aabb = { left: 16, top: 0, right: 26, bottom: 10 };
    // Entity at wz=0, surface at 2*8=16 → blocked
    expect(isElevationBlocked3D(aabb, 0, getHeight)).toBe(true);
  });

  it("allows when entity wz equals surface", () => {
    const getHeight = heightMap({ "1,0": 2 });
    const aabb = { left: 16, top: 0, right: 26, bottom: 10 };
    // Entity at wz=16, surface at 16 → not blocked
    expect(isElevationBlocked3D(aabb, 2 * ELEVATION_PX, getHeight)).toBe(false);
  });

  it("allows when entity wz is above surface", () => {
    const getHeight = heightMap({ "1,0": 1 });
    const aabb = { left: 16, top: 0, right: 26, bottom: 10 };
    // Entity at wz=16, surface at 8 → not blocked
    expect(isElevationBlocked3D(aabb, 2 * ELEVATION_PX, getHeight)).toBe(false);
  });

  it("blocks when AABB straddles high and low tiles and entity is at low level", () => {
    // This is the edge bug fix: AABB straddles height 0 and height 2
    const getHeight = heightMap({ "1,0": 2 });
    const aabb = { left: 12, top: 4, right: 20, bottom: 12 };
    // Entity at wz=0, max surface = 2*8=16 → blocked
    expect(isElevationBlocked3D(aabb, 0, getHeight)).toBe(true);
  });

  it("respects stepUpThreshold", () => {
    const getHeight = heightMap({ "1,0": 1 });
    const aabb = { left: 16, top: 0, right: 26, bottom: 10 };
    // Entity at wz=0, surface at 8, threshold=8 → 8 > 0+8 → false (not blocked)
    expect(isElevationBlocked3D(aabb, 0, getHeight, ELEVATION_PX)).toBe(false);
    // Entity at wz=0, surface at 8, threshold=4 → 8 > 0+4 → true (blocked)
    expect(isElevationBlocked3D(aabb, 0, getHeight, 4)).toBe(true);
  });

  it("allows on flat terrain", () => {
    const aabb = { left: 10, top: 10, right: 20, bottom: 20 };
    expect(isElevationBlocked3D(aabb, 0, () => 0)).toBe(false);
  });
});

describe("getEffectiveGroundZ", () => {
  const collider = { offsetX: 0, offsetY: 0, width: 10, height: 10 };

  it("uses center point when entity has no collider", () => {
    const getHeight = heightMap({ "6,6": 2 });
    const entity = { position: { wx: 100, wy: 100 }, collider: null, id: 1 };
    expect(getEffectiveGroundZ(entity, getHeight, [], [])).toBe(2 * ELEVATION_PX);
  });

  it("uses AABB max when entity has a collider", () => {
    // Tile (0,0) at height 0, tile (1,0) at height 2.
    // Entity center is on tile 0 but AABB straddles into tile 1.
    const getHeight = heightMap({ "1,0": 2 });
    const entity = { position: { wx: 14, wy: 5 }, collider, id: 1 };
    // Center on tile 0 (wx=14 → tx=0), but AABB right = 14+5 = 19 → tile 1
    expect(getEffectiveGroundZ(entity, getHeight, [], [])).toBe(2 * ELEVATION_PX);
  });

  it("center-point fallback returns lower tile for no-collider entity", () => {
    const getHeight = heightMap({ "1,0": 2 });
    // Center at wx=14 → tile 0 (height 0), even though tile 1 is elevated
    const entity = { position: { wx: 14, wy: 5 }, collider: null, id: 1 };
    expect(getEffectiveGroundZ(entity, getHeight, [], [])).toBe(0);
  });

  it("returns walkable prop surface when higher than terrain", () => {
    const entity = { position: { wx: 50, wy: 50 }, collider, id: 1, wz: 10 };
    const prop = {
      position: { wx: 50, wy: 50 },
      collider: {
        offsetX: -8,
        offsetY: -8,
        width: 16,
        height: 16,
        walkableTop: true,
        zHeight: 12,
      },
      walls: null,
    };
    expect(getEffectiveGroundZ(entity, () => 0, [prop], [])).toBe(12);
  });

  it("returns walkable entity surface when higher than terrain", () => {
    const entity = { position: { wx: 50, wy: 50 }, collider, id: 1, wz: 10 };
    const other = {
      id: 2,
      position: { wx: 50, wy: 50 },
      collider: { offsetX: -8, offsetY: -8, width: 16, height: 16, physicalHeight: 12 },
      wz: 0,
    };
    expect(getEffectiveGroundZ(entity, () => 0, [], [other])).toBe(12);
  });

  it("terrain wins when higher than prop/entity surfaces", () => {
    const getHeight = heightMap({ "3,3": 3 }); // 3 * 8 = 24
    const entity = { position: { wx: 50, wy: 50 }, collider, id: 1, wz: 24 };
    const prop = {
      position: { wx: 50, wy: 50 },
      collider: {
        offsetX: -8,
        offsetY: -8,
        width: 16,
        height: 16,
        walkableTop: true,
        zHeight: 10,
      },
      walls: null,
    };
    expect(getEffectiveGroundZ(entity, getHeight, [prop], [])).toBe(3 * ELEVATION_PX);
  });
});

describe("resolveGroundZForTracking", () => {
  it("includes feet tile height when an offset collider's AABB has left the north edge", () => {
    // Elevated tile at (0,0), flat north tile at (0,-1)
    const getHeight = heightMap({ "0,0": 2 });
    // Player-like collider whose AABB sits above feet.
    // At wy=0.5 (still on tile 0), AABB bottom is -2.5 and no longer overlaps tile 0.
    const collider = { offsetX: 0, offsetY: -3, width: 10, height: 6 };
    const entity = { position: { wx: 8, wy: 0.5 }, collider, id: 1, wz: 2 * ELEVATION_PX };

    expect(resolveGroundZForTracking(entity, getHeight, [], [])).toBe(2 * ELEVATION_PX);
  });
});

describe("resolveGroundZForLanding", () => {
  const collider = { offsetX: 0, offsetY: 0, width: 10, height: 10 };

  it("uses AABB-max terrain when entity has a collider", () => {
    const getHeight = heightMap({ "1,0": 2 });
    const entity = { position: { wx: 14, wy: 5 }, collider, id: 1, wz: 2 * ELEVATION_PX };
    expect(resolveGroundZForLanding(entity, getHeight)).toBe(2 * ELEVATION_PX);
  });

  it("includes feet tile height when an offset collider's AABB has left the north edge", () => {
    const getHeight = heightMap({ "0,0": 2 });
    const offsetCollider = { offsetX: 0, offsetY: -3, width: 10, height: 6 };
    const entity = { position: { wx: 8, wy: 0.5 }, collider: offsetCollider, id: 1, wz: 4 };

    expect(resolveGroundZForLanding(entity, getHeight)).toBe(2 * ELEVATION_PX);
  });

  it("filters entity-top landing by descended-through prevWz", () => {
    const entity = { position: { wx: 50, wy: 50 }, collider, id: 1, wz: 10 };
    const platform = {
      id: 2,
      position: { wx: 50, wy: 50 },
      collider: { offsetX: -8, offsetY: -8, width: 16, height: 16, physicalHeight: 12 },
      wz: 0,
    };

    expect(resolveGroundZForLanding(entity, () => 0, [], [platform], 8)).toBe(0);
    expect(resolveGroundZForLanding(entity, () => 0, [], [platform], 20)).toBe(12);
  });
});

describe("applyGroundTracking", () => {
  it("initializes wz on first frame", () => {
    const entity: { wz?: number; jumpVZ?: number; jumpZ?: number; groundZ?: number } = {};
    applyGroundTracking(entity, 16, true);
    expect(entity.wz).toBe(16);
    expect(entity.groundZ).toBe(16);
  });

  it("snaps grounded entity to ground when at same level", () => {
    const entity = { wz: 16, groundZ: 16 };
    applyGroundTracking(entity, 16, true);
    expect(entity.wz).toBe(16);
  });

  it("snaps grounded entity up to higher ground", () => {
    const entity = { wz: 8, groundZ: 8 };
    applyGroundTracking(entity, 16, true);
    expect(entity.wz).toBe(16);
  });

  it("snaps down for small step (within STEP_UP_THRESHOLD)", () => {
    const entity: { wz?: number; jumpVZ?: number; jumpZ?: number; groundZ?: number } = {
      wz: STEP_UP_THRESHOLD,
      jumpZ: STEP_UP_THRESHOLD,
    };
    applyGroundTracking(entity, 0, true);
    expect(entity.wz).toBe(0);
    expect(entity.jumpZ).toBeUndefined();
    expect(entity.jumpVZ).toBeUndefined();
  });

  it("starts fall for cliff edge (beyond STEP_UP_THRESHOLD) when canFall", () => {
    const drop = STEP_UP_THRESHOLD + 1;
    const entity: { wz?: number; jumpVZ?: number; jumpZ?: number; groundZ?: number } = {
      wz: drop,
    };
    applyGroundTracking(entity, 0, true);
    expect(entity.jumpVZ).toBe(0);
    expect(entity.jumpZ).toBe(drop);
    expect(entity.wz).toBe(drop); // hasn't fallen yet, just started
  });

  it("snaps down instead of falling when canFall is false (NPCs)", () => {
    const entity: { wz?: number; jumpVZ?: number; jumpZ?: number; groundZ?: number } = {
      wz: 2 * ELEVATION_PX,
    };
    applyGroundTracking(entity, 0, false);
    expect(entity.wz).toBe(0);
    expect(entity.jumpVZ).toBeUndefined();
  });

  it("does not modify airborne entity (jumpVZ defined)", () => {
    const entity = { wz: 20, jumpVZ: -5, jumpZ: 12, groundZ: 8 };
    applyGroundTracking(entity, 0, true);
    // Only groundZ should update; wz and jumpVZ untouched
    expect(entity.groundZ).toBe(0);
    expect(entity.wz).toBe(20);
    expect(entity.jumpVZ).toBe(-5);
  });

  it("cleans up jumpZ on ground snap", () => {
    const entity: { wz?: number; jumpVZ?: number; jumpZ?: number; groundZ?: number } = {
      wz: 8,
      jumpZ: 4,
    };
    applyGroundTracking(entity, 8, true);
    expect(entity.jumpZ).toBeUndefined();
  });
});

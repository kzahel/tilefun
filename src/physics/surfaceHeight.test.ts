import { describe, expect, it } from "vitest";
import { ELEVATION_PX, TILE_SIZE } from "../config/constants.js";
import { getMaxSurfaceZUnderAABB, getSurfaceZ, isElevationBlocked3D } from "./surfaceHeight.js";

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

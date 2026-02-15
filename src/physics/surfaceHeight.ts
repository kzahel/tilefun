import { ELEVATION_PX, TILE_SIZE } from "../config/constants.js";
import type { AABB } from "../entities/collision.js";

/**
 * Terrain surface height at a world-pixel point, in world pixels.
 * Converts from tile elevation (integer 0–3) to absolute Z.
 */
export function getSurfaceZ(
  wx: number,
  wy: number,
  getHeight: (tx: number, ty: number) => number,
): number {
  const tx = Math.floor(wx / TILE_SIZE);
  const ty = Math.floor(wy / TILE_SIZE);
  return getHeight(tx, ty) * ELEVATION_PX;
}

/**
 * Maximum terrain surface Z across all tiles under an AABB footprint.
 * Used to check if any part of an entity's collision box would overlap
 * elevated terrain.
 */
export function getMaxSurfaceZUnderAABB(
  aabb: AABB,
  getHeight: (tx: number, ty: number) => number,
): number {
  const minTx = Math.floor(aabb.left / TILE_SIZE);
  const maxTx = Math.floor((aabb.right - 0.001) / TILE_SIZE);
  const minTy = Math.floor(aabb.top / TILE_SIZE);
  const maxTy = Math.floor((aabb.bottom - 0.001) / TILE_SIZE);
  let maxZ = 0;
  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      const z = getHeight(tx, ty) * ELEVATION_PX;
      if (z > maxZ) maxZ = z;
    }
  }
  return maxZ;
}

/**
 * Check if an AABB's proposed position is blocked by elevated terrain.
 * Checks ALL tiles under the AABB (not just feet center), fixing the
 * edge-straddling bug where entities get stuck on elevation boundaries.
 *
 * Returns true when any tile under the AABB has surface Z higher than
 * the entity can step up to.
 */
export function isElevationBlocked3D(
  aabb: AABB,
  entityWz: number,
  getHeight: (tx: number, ty: number) => number,
  stepUpThreshold = 0,
): boolean {
  return getMaxSurfaceZUnderAABB(aabb, getHeight) > entityWz + stepUpThreshold;
}

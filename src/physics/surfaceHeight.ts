import { ELEVATION_PX, STEP_UP_THRESHOLD, TILE_SIZE } from "../config/constants.js";
import type { AABB } from "../entities/collision.js";
import { aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import type { ColliderComponent } from "../entities/Entity.js";
import type { PropCollider } from "../entities/Prop.js";
import { querySurfacePatch } from "./SurfacePatch.js";
import { terrainBaseZ } from "./TerrainExcavation.js";

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

/** Read-only terrain/prop height for admission and editor placement. Moving body
 * support and landing are resolved exclusively by PhysicsScene. */
export function placementGroundZ(
  entity: {
    position: { wx: number; wy: number };
    collider: ColliderComponent | null;
    id: number;
    wz?: number;
  },
  getHeight: (tx: number, ty: number) => number,
  props: readonly PropSurface[],
): number {
  const groundFootprint = entity.collider ? getEntityAABB(entity.position, entity.collider) : null;
  let groundZ = getTerrainGroundZ(entity, getHeight, props);
  const propZ = groundFootprint
    ? getWalkablePropSurfaceZ(groundFootprint, entity.wz ?? 0, props)
    : undefined;
  if (propZ !== undefined && propZ > groundZ) groundZ = propZ;
  return groundZ;
}

/**
 * Terrain ground Z for an entity.
 * For colliders, include both full-footprint max and feet tile surface so
 * offset colliders don't drop below the tile under their feet at edges.
 */
function getTerrainGroundZ(
  entity: {
    position: { wx: number; wy: number };
    collider: ColliderComponent | null;
  },
  getHeight: (tx: number, ty: number) => number,
  props: readonly PropSurface[] = [],
): number {
  const feetZ = getSurfaceZ(entity.position.wx, entity.position.wy, getHeight);
  if (!entity.collider) return feetZ;
  const footprint = getEntityAABB(entity.position, entity.collider);
  if (
    !props.some((p) =>
      (p.walls ?? (p.collider ? [p.collider] : [])).some((c) => c.surface?.excavation),
    )
  )
    return Math.max(getMaxSurfaceZUnderAABB(footprint, getHeight), feetZ);
  const footprintZ = terrainBaseZ(footprint, getHeight, props);
  // Feet on the footprint's inclusive edge belong to that support, not the next
  // terrain tile. Offset anchors outside it still contribute their own sample.
  const { wx, wy } = entity.position;
  if (
    wx >= footprint.left &&
    wx <= footprint.right &&
    wy >= footprint.top &&
    wy <= footprint.bottom
  )
    return footprintZ;
  const anchorZ = terrainBaseZ(
    { left: wx - 0.001, right: wx + 0.001, top: wy - 0.001, bottom: wy + 0.001 },
    getHeight,
    props,
  );
  return Math.max(footprintZ, anchorZ);
}

/** Minimal prop shape for surface queries. Works with both Prop and PropSnapshot. */
export interface PropSurface {
  position: { wx: number; wy: number };
  collider: PropCollider | null;
  walls: PropCollider[] | null;
}

/**
 * Get the highest walkable prop surface Z under an entity's AABB footprint.
 * Only considers colliders/walls with `walkableTop: true` and finite `zHeight`.
 * Returns undefined if no walkable prop surfaces overlap.
 */
export function getWalkablePropSurfaceZ(
  aabb: AABB,
  entityWz: number,
  props: readonly PropSurface[],
): number | undefined {
  let maxZ: number | undefined;
  for (const prop of props) {
    const colliders = prop.walls ?? (prop.collider ? [prop.collider] : []);
    for (const c of colliders) {
      if (c.surface) {
        const hit = querySurfacePatch(c.surface, getEntityAABB(prop.position, c), aabb);
        if (
          hit &&
          Math.abs(entityWz - hit.topMax) <= STEP_UP_THRESHOLD &&
          (maxZ === undefined || hit.topMax > maxZ)
        )
          maxZ = hit.topMax;
        continue;
      }
      if (!c.walkableTop || c.zHeight === undefined) continue;
      const topZ = (c.zBase ?? 0) + c.zHeight;
      // Only walk on top if entity is within step-up range of the surface
      if (entityWz + STEP_UP_THRESHOLD < topZ) continue; // too far below
      if (entityWz > topZ + STEP_UP_THRESHOLD) continue; // too far above
      // Check XY overlap
      if (aabbsOverlap(aabb, getEntityAABB(prop.position, c))) {
        if (maxZ === undefined || topZ > maxZ) maxZ = topZ;
      }
    }
  }
  return maxZ;
}

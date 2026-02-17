import { ELEVATION_PX, STEP_UP_THRESHOLD, TILE_SIZE } from "../config/constants.js";
import type { AABB } from "../entities/collision.js";
import { aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import type { ColliderComponent } from "../entities/Entity.js";
import type { PropCollider } from "../entities/Prop.js";

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

/**
 * Compute the effective ground Z for an entity, considering terrain elevation
 * (AABB max), walkable prop surfaces, and walkable entity surfaces.
 *
 * Shared between server (EntityManager) and client (PlayerPredictor) to keep
 * ground tracking in sync. Callers are responsible for providing nearby
 * props/entities from their own spatial queries.
 */
export function resolveGroundZForTracking(
  entity: {
    position: { wx: number; wy: number };
    collider: ColliderComponent | null;
    id: number;
    wz?: number;
  },
  getHeight: (tx: number, ty: number) => number,
  props: readonly PropSurface[],
  entities: readonly EntitySurface[],
): number {
  const groundFootprint = entity.collider ? getEntityAABB(entity.position, entity.collider) : null;
  let groundZ = getTerrainGroundZ(entity, getHeight);
  const propZ = groundFootprint
    ? getWalkablePropSurfaceZ(groundFootprint, entity.wz ?? 0, props)
    : undefined;
  if (propZ !== undefined && propZ > groundZ) groundZ = propZ;
  const entZ = groundFootprint
    ? getWalkableEntitySurfaceZ(groundFootprint, entity.id, entity.wz ?? 0, entities)
    : undefined;
  if (entZ !== undefined && entZ > groundZ) groundZ = entZ;
  return groundZ;
}

/**
 * Resolve landing ground Z for airborne entities.
 *
 * Uses full-footprint terrain sampling and "highest descended-through"
 * walkable surfaces for props/entities (no step-up threshold filter).
 */
export function resolveGroundZForLanding(
  entity: {
    position: { wx: number; wy: number };
    collider: ColliderComponent | null;
    id: number;
    wz?: number;
  },
  getHeight: (tx: number, ty: number) => number,
  props?: readonly PropSurface[],
  entities?: readonly EntitySurface[],
  prevWz?: number,
): number {
  const groundFootprint = entity.collider ? getEntityAABB(entity.position, entity.collider) : null;
  let groundZ = getTerrainGroundZ(entity, getHeight);
  if (props) {
    const propZ = groundFootprint
      ? getHighestWalkablePropSurfaceZ(groundFootprint, props)
      : undefined;
    if (propZ !== undefined && propZ > groundZ) groundZ = propZ;
  }
  if (entities) {
    const entZ = groundFootprint
      ? getHighestWalkableEntitySurfaceZ(
          groundFootprint,
          entity.id,
          entity.wz ?? 0,
          entities,
          prevWz,
        )
      : undefined;
    if (entZ !== undefined && entZ > groundZ) groundZ = entZ;
  }
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
): number {
  const feetZ = getSurfaceZ(entity.position.wx, entity.position.wy, getHeight);
  if (!entity.collider) return feetZ;
  const footprint = getEntityAABB(entity.position, entity.collider);
  const footprintZ = getMaxSurfaceZUnderAABB(footprint, getHeight);
  return Math.max(footprintZ, feetZ);
}

/**
 * @deprecated Use resolveGroundZForTracking instead.
 */
export function getEffectiveGroundZ(
  entity: {
    position: { wx: number; wy: number };
    collider: ColliderComponent | null;
    id: number;
    wz?: number;
  },
  getHeight: (tx: number, ty: number) => number,
  props: readonly PropSurface[],
  entities: readonly EntitySurface[],
): number {
  return resolveGroundZForTracking(entity, getHeight, props, entities);
}

/**
 * Apply ground tracking to a grounded entity: snap wz to ground, or detect
 * cliff edges and start falling. Sets entity.groundZ as a side-effect.
 *
 * When `canFall` is true (players), stepping off a ledge > STEP_UP_THRESHOLD
 * triggers a fall instead of snapping down. When false (NPCs), always snap.
 *
 * Shared between server (EntityManager) and client (PlayerPredictor).
 */
export function applyGroundTracking(
  entity: {
    wz?: number;
    jumpVZ?: number;
    jumpZ?: number;
    groundZ?: number;
  },
  groundZ: number,
  canFall: boolean,
): void {
  entity.groundZ = groundZ;
  if (entity.wz === undefined) {
    entity.wz = groundZ;
  } else if (entity.jumpVZ === undefined) {
    if (entity.wz > groundZ && canFall) {
      if (entity.wz - groundZ <= STEP_UP_THRESHOLD) {
        entity.wz = groundZ;
        delete entity.jumpZ;
      } else {
        entity.jumpVZ = 0;
        entity.jumpZ = entity.wz - groundZ;
      }
    } else if (entity.jumpVZ === undefined) {
      entity.wz = groundZ;
      delete entity.jumpZ;
    }
  }
}

/** Minimal entity shape for surface queries. Works with both Entity and EntitySnapshot. */
export interface EntitySurface {
  id: number;
  position: { wx: number; wy: number };
  collider: ColliderComponent | null;
  wz?: number;
}

/** Minimal prop shape for surface queries. Works with both Prop and PropSnapshot. */
export interface PropSurface {
  position: { wx: number; wy: number };
  collider: PropCollider | null;
  walls: PropCollider[] | null;
}

/**
 * Get the highest walkable prop surface Z under an AABB footprint, ignoring
 * entity height. Used for landing checks during jump/fall — we want to land
 * on any walkable surface we descend through, not just those within step-up range.
 */
export function getHighestWalkablePropSurfaceZ(
  aabb: AABB,
  props: readonly PropSurface[],
): number | undefined {
  let maxZ: number | undefined;
  for (const prop of props) {
    const colliders = prop.walls ?? (prop.collider ? [prop.collider] : []);
    for (const c of colliders) {
      if (!c.walkableTop || c.zHeight === undefined) continue;
      const topZ = (c.zBase ?? 0) + c.zHeight;
      if (aabbsOverlap(aabb, getEntityAABB(prop.position, c))) {
        if (maxZ === undefined || topZ > maxZ) maxZ = topZ;
      }
    }
  }
  return maxZ;
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

/**
 * Get the highest walkable entity surface Z under an AABB footprint, ignoring
 * height threshold. Used for landing checks during jump/fall — land on any
 * solid entity we descend through.
 *
 * Only considers entities whose feet are at or below selfWz — prevents
 * entities below from "landing" on entities above (infinite lift feedback loop).
 *
 * When prevWz is provided (pre-gravity wz), only considers surfaces that the
 * entity was at or above before this tick's gravity — prevents teleporting
 * upward onto surfaces the entity hasn't descended through.
 */
export function getHighestWalkableEntitySurfaceZ(
  aabb: AABB,
  selfId: number,
  selfWz: number,
  entities: readonly EntitySurface[],
  prevWz?: number,
): number | undefined {
  let maxZ: number | undefined;
  for (const e of entities) {
    if (e.id === selfId || !e.collider || e.collider.solid === false) continue;
    const physH = e.collider.physicalHeight;
    if (physH === undefined) continue;
    const eWz = e.wz ?? 0;
    if (eWz > selfWz) continue; // entity's feet are above ours — we're below it
    const topZ = eWz + physH;
    // Only land on surfaces we were at or above before gravity (descended through)
    if (prevWz !== undefined && topZ > prevWz) continue;
    if (aabbsOverlap(aabb, getEntityAABB(e.position, e.collider))) {
      if (maxZ === undefined || topZ > maxZ) maxZ = topZ;
    }
  }
  return maxZ;
}

/**
 * Get the highest walkable entity surface Z under an AABB footprint,
 * within step-up range. Used for ground tracking while walking.
 */
export function getWalkableEntitySurfaceZ(
  aabb: AABB,
  selfId: number,
  entityWz: number,
  entities: readonly EntitySurface[],
): number | undefined {
  let maxZ: number | undefined;
  for (const e of entities) {
    if (e.id === selfId || !e.collider || e.collider.solid === false) continue;
    const physH = e.collider.physicalHeight;
    if (physH === undefined) continue;
    const eWz = e.wz ?? 0;
    if (eWz > entityWz) continue; // entity's feet are above ours — we're below it
    const topZ = eWz + physH;
    if (entityWz + STEP_UP_THRESHOLD < topZ) continue; // too far below
    if (entityWz > topZ + STEP_UP_THRESHOLD) continue; // too far above
    if (aabbsOverlap(aabb, getEntityAABB(e.position, e.collider))) {
      if (maxZ === undefined || topZ > maxZ) maxZ = topZ;
    }
  }
  return maxZ;
}

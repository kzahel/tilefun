import { TILE_SIZE } from "../config/constants.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import type { Entity, PositionComponent } from "./Entity.js";

export interface AABB {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Any collider-shaped object (works for both ColliderComponent and PropCollider). */
type ColliderLike = { offsetX: number; offsetY: number; width: number; height: number };

/** Compute world-space AABB from a position + collider. */
export function getEntityAABB(pos: { wx: number; wy: number }, collider: ColliderLike): AABB {
  return {
    left: pos.wx + collider.offsetX - collider.width / 2,
    top: pos.wy + collider.offsetY - collider.height,
    right: pos.wx + collider.offsetX + collider.width / 2,
    bottom: pos.wy + collider.offsetY,
  };
}

/** Check if two AABBs overlap (strict inequality — touching edges don't count). */
export function aabbsOverlap(a: AABB, b: AABB): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/** Check if an AABB overlaps any entity collider, skipping entities in the exclude set. */
export function aabbOverlapsAnyEntity(
  aabb: AABB,
  excludeIds: ReadonlySet<number>,
  entities: readonly Entity[],
): boolean {
  for (const other of entities) {
    if (excludeIds.has(other.id) || !other.collider) continue;
    if (aabbsOverlap(aabb, getEntityAABB(other.position, other.collider))) return true;
  }
  return false;
}

/** Check if an AABB overlaps any tile matching the block mask. */
export function aabbOverlapsSolid(
  aabb: AABB,
  getCollision: (tx: number, ty: number) => number,
  blockMask: number,
): boolean {
  const minTx = Math.floor(aabb.left / TILE_SIZE);
  const maxTx = Math.floor((aabb.right - 0.001) / TILE_SIZE);
  const minTy = Math.floor(aabb.top / TILE_SIZE);
  const maxTy = Math.floor((aabb.bottom - 0.001) / TILE_SIZE);

  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      if (getCollision(tx, ty) & blockMask) return true;
    }
  }
  return false;
}

/**
 * Resolve entity movement with per-axis sliding collision.
 * Mutates entity.position in place. Returns true if any axis was blocked.
 * Optional `isExtraBlocked` checks additional AABB obstacles (props, other entities).
 */
export function resolveCollision(
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
    blocked = true;
  }

  return blocked;
}

/** Get speed multiplier based on terrain under entity feet. */
export function getSpeedMultiplier(
  pos: PositionComponent,
  getCollision: (tx: number, ty: number) => number,
): number {
  const tx = Math.floor(pos.wx / TILE_SIZE);
  const ty = Math.floor(pos.wy / TILE_SIZE);
  if (getCollision(tx, ty) & CollisionFlag.SlowWalk) return 0.5;
  return 1.0;
}

import { TILE_SIZE } from "../config/constants.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import type { ColliderComponent, Entity, PositionComponent } from "./Entity.js";

export interface AABB {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Compute world-space AABB from entity position + collider. */
export function getEntityAABB(pos: PositionComponent, collider: ColliderComponent): AABB {
  return {
    left: pos.wx + collider.offsetX - collider.width / 2,
    top: pos.wy + collider.offsetY - collider.height,
    right: pos.wx + collider.offsetX + collider.width / 2,
    bottom: pos.wy + collider.offsetY,
  };
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
 */
export function resolveCollision(
  entity: Entity,
  dx: number,
  dy: number,
  getCollision: (tx: number, ty: number) => number,
  blockMask: number,
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
  if (!aabbOverlapsSolid(getEntityAABB(testX, entity.collider), getCollision, blockMask)) {
    entity.position.wx = testX.wx;
  } else {
    blocked = true;
  }

  // Try Y axis (using updated X position)
  const testY: PositionComponent = {
    wx: entity.position.wx,
    wy: entity.position.wy + dy,
  };
  if (!aabbOverlapsSolid(getEntityAABB(testY, entity.collider), getCollision, blockMask)) {
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

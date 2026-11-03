import { TILE_SIZE } from "../config/constants.js";
import { querySurfacePatch } from "../physics/SurfacePatch.js";
import type { PropCollider } from "./Prop.js";

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

/**
 * Check if a prop collider's Z range overlaps an entity's Z range.
 * When entityWz/entityHeight are undefined, always returns true (no Z filtering).
 */
function propColliderOverlapsZ(
  c: PropCollider,
  entityWz: number | undefined,
  entityHeight: number | undefined,
): boolean {
  if (entityWz === undefined || entityHeight === undefined) return true;
  const wallBase = c.zBase ?? 0;
  const wallHeight = c.zHeight;
  if (wallHeight === undefined) {
    // Infinite height — only skip if entity is entirely below zBase
    return entityWz + entityHeight > wallBase;
  }
  const wallTop = wallBase + wallHeight;
  // Ranges overlap when neither is entirely above/below the other
  return entityWz < wallTop && entityWz + entityHeight > wallBase;
}

function propColliderBlocks(
  c: PropCollider,
  propPos: { wx: number; wy: number },
  aabb: AABB,
  entityWz?: number,
  entityHeight?: number,
): boolean {
  if (c.passable) return false;
  if (c.surface) {
    const hit = querySurfacePatch(c.surface, getEntityAABB(propPos, c), aabb);
    if (!hit) return false;
    if (entityWz === undefined || entityHeight === undefined) return true;
    return entityWz < hit.topMax - 0.001 && entityWz + entityHeight > hit.bottomMin + 0.001;
  }
  return (
    propColliderOverlapsZ(c, entityWz, entityHeight) &&
    aabbsOverlap(aabb, getEntityAABB(propPos, c))
  );
}

/**
 * Check if an AABB overlaps a prop's wall segments (enterable props) or single collider.
 * When entityWz and entityHeight are provided, performs Z-axis filtering — walls whose
 * Z range doesn't overlap the entity's Z range are skipped (e.g., walking under a bridge).
 */
export function aabbOverlapsPropWalls(
  aabb: AABB,
  propPos: { wx: number; wy: number },
  prop: { collider: PropCollider | null; walls: PropCollider[] | null },
  entityWz?: number,
  entityHeight?: number,
): boolean {
  if (prop.walls) {
    for (const wall of prop.walls) {
      if (propColliderBlocks(wall, propPos, aabb, entityWz, entityHeight)) return true;
    }
    return false;
  }
  if (prop.collider) {
    return propColliderBlocks(prop.collider, propPos, aabb, entityWz, entityHeight);
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

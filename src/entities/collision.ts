import { TILE_SIZE } from "../config/constants.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import type { Entity, PositionComponent } from "./Entity.js";
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

/** Check if an AABB overlaps a prop's wall segments (enterable props) or single collider. */
export function aabbOverlapsPropWalls(
  aabb: AABB,
  propPos: { wx: number; wy: number },
  prop: { collider: PropCollider | null; walls: PropCollider[] | null },
): boolean {
  if (prop.walls) {
    for (const wall of prop.walls) {
      if (aabbsOverlap(aabb, getEntityAABB(propPos, wall))) return true;
    }
    return false;
  }
  if (prop.collider) {
    return aabbsOverlap(aabb, getEntityAABB(propPos, prop.collider));
  }
  return false;
}

/** Check if an AABB overlaps any entity collider, skipping entities in the exclude set. */
export function aabbOverlapsAnyEntity(
  aabb: AABB,
  excludeIds: ReadonlySet<number>,
  entities: readonly Entity[],
): boolean {
  for (const other of entities) {
    if (excludeIds.has(other.id) || !other.collider || other.collider.solid === false) continue;
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

/** Separation speed in pixels per second for overlapping entities. */
const SEPARATION_SPEED = 40;

/**
 * Gently push apart overlapping solid wandering entities using a spatial hash.
 * Also separates entities that overlap with the player (pushing only the entity).
 * Mutates entity positions in place. Respects tile collision (won't push through walls).
 */
export function separateOverlappingEntities(
  entities: readonly Entity[],
  players: ReadonlySet<Entity>,
  dt: number,
  getCollision: (tx: number, ty: number) => number,
  blockMask: number,
): void {
  // 1. Bucket eligible entities into a spatial hash (cell size = TILE_SIZE)
  const grid = new Map<number, Entity[]>();
  const pushableEntities: Entity[] = [];
  for (const entity of entities) {
    if (
      players.has(entity) ||
      !entity.collider ||
      entity.collider.solid === false ||
      !entity.wanderAI
    )
      continue;
    pushableEntities.push(entity);
    const aabb = getEntityAABB(entity.position, entity.collider);
    const minCx = Math.floor(aabb.left / TILE_SIZE);
    const maxCx = Math.floor(aabb.right / TILE_SIZE);
    const minCy = Math.floor(aabb.top / TILE_SIZE);
    const maxCy = Math.floor(aabb.bottom / TILE_SIZE);
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        // Pack cell coords into a single number for fast hashing.
        // Offset by 0x8000 to handle negative coords (up to +-32767).
        const key = ((cx + 0x8000) << 16) | ((cy + 0x8000) & 0xffff);
        let bucket = grid.get(key);
        if (!bucket) {
          bucket = [];
          grid.set(key, bucket);
        }
        bucket.push(entity);
      }
    }
  }

  // 2. Separate entities overlapping with players (push only the entity, not the player)
  // Skip when player is jumping — entities should stay put while being vaulted over.
  for (const player of players) {
    if (!player.collider || (player.jumpZ ?? 0) > 0) continue;
    const playerBox = getEntityAABB(player.position, player.collider);
    for (const entity of pushableEntities) {
      if (!entity.collider) continue;
      const entityBox = getEntityAABB(entity.position, entity.collider);
      if (!aabbsOverlap(playerBox, entityBox)) continue;

      // Compute overlap depth on each axis
      const overlapX =
        Math.min(playerBox.right, entityBox.right) - Math.max(playerBox.left, entityBox.left);
      const overlapY =
        Math.min(playerBox.bottom, entityBox.bottom) - Math.max(playerBox.top, entityBox.top);

      // Push entity out along the axis with smallest overlap (minimum penetration)
      let nx = 0;
      let ny = 0;
      if (overlapX < overlapY) {
        nx = entity.position.wx > player.position.wx ? overlapX + 0.5 : -(overlapX + 0.5);
      } else {
        ny = entity.position.wy > player.position.wy ? overlapY + 0.5 : -(overlapY + 0.5);
      }

      const testBox = getEntityAABB(
        { wx: entity.position.wx + nx, wy: entity.position.wy + ny },
        entity.collider,
      );
      if (!aabbOverlapsSolid(testBox, getCollision, blockMask)) {
        entity.position.wx += nx;
        entity.position.wy += ny;
      }
    }
  }

  // 3. Find and separate overlapping entity-entity pairs
  const seen = new Set<number>();
  for (const cell of grid.values()) {
    if (cell.length < 2) continue;
    for (let i = 0; i < cell.length; i++) {
      const a = cell[i];
      if (!a?.collider) continue;
      for (let j = i + 1; j < cell.length; j++) {
        const b = cell[j];
        if (!b?.collider) continue;
        const lo = a.id < b.id ? a : b;
        const hi = a.id < b.id ? b : a;
        const pairKey = lo.id * 100000 + hi.id;
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);

        const aBox = getEntityAABB(a.position, a.collider);
        const bBox = getEntityAABB(b.position, b.collider);
        if (!aabbsOverlap(aBox, bBox)) continue;

        // Compute separation direction (center to center)
        let dx = b.position.wx - a.position.wx;
        let dy = b.position.wy - a.position.wy;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.1) {
          // Coincident centers — deterministic fallback
          dx = 1;
          dy = 0;
          dist = 1;
        }
        const nudge = (SEPARATION_SPEED * dt * 0.5) / dist;
        const nx = dx * nudge;
        const ny = dy * nudge;

        // Nudge A away (negative direction), check wall collision first
        const testA = getEntityAABB({ wx: a.position.wx - nx, wy: a.position.wy - ny }, a.collider);
        if (!aabbOverlapsSolid(testA, getCollision, blockMask)) {
          a.position.wx -= nx;
          a.position.wy -= ny;
        }

        // Nudge B away (positive direction)
        const testB = getEntityAABB({ wx: b.position.wx + nx, wy: b.position.wy + ny }, b.collider);
        if (!aabbOverlapsSolid(testB, getCollision, blockMask)) {
          b.position.wx += nx;
          b.position.wy += ny;
        }
      }
    }
  }
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

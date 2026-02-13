import { CHUNK_SIZE_PX } from "../config/constants.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import type { AABB } from "./collision.js";
import {
  aabbOverlapsAnyEntity,
  aabbsOverlap,
  getEntityAABB,
  getSpeedMultiplier,
  resolveCollision,
} from "./collision.js";
import type { Entity } from "./Entity.js";
import type { PropManager } from "./PropManager.js";
import { onWanderBlocked } from "./wanderAI.js";

/** Fraction of player speed applied to pushed entities. */
const PUSH_SPEED_FRACTION = 0.3;
/** Player speed multiplier while pushing an entity. */
const PUSH_PLAYER_SPEED_MULT = 0.5;

export class EntityManager {
  readonly entities: Entity[] = [];
  private nextId = 1;

  getNextId(): number {
    return this.nextId;
  }

  setNextId(n: number): void {
    this.nextId = n;
  }

  /** Add an entity to the world. Assigns a unique id. */
  spawn(entity: Entity): Entity {
    entity.id = this.nextId++;
    this.entities.push(entity);
    return entity;
  }

  /** Update all entities: apply velocity with collision, tick animation. */
  update(
    dt: number,
    getCollision: (tx: number, ty: number) => number,
    player: Entity,
    propManager: PropManager,
  ): void {
    const blockMask = CollisionFlag.Solid | CollisionFlag.Water;

    // Helper: check if an AABB overlaps any prop collider (chunk-indexed)
    const overlapsAnyProp = (aabb: AABB): boolean => {
      const minCx = Math.floor(aabb.left / CHUNK_SIZE_PX);
      const maxCx = Math.floor(aabb.right / CHUNK_SIZE_PX);
      const minCy = Math.floor(aabb.top / CHUNK_SIZE_PX);
      const maxCy = Math.floor(aabb.bottom / CHUNK_SIZE_PX);
      for (const prop of propManager.getPropsInChunkRange(minCx, minCy, maxCx, maxCy)) {
        if (prop.collider && aabbsOverlap(aabb, getEntityAABB(prop.position, prop.collider))) {
          return true;
        }
      }
      return false;
    };

    // Helper: build extra-blocker for resolveCollision (props + other entities).
    const makeExtraBlocker =
      (self: Entity, alsoExclude?: Entity) =>
      (aabb: AABB): boolean => {
        if (overlapsAnyProp(aabb)) return true;
        const excludeIds = alsoExclude ? new Set([self.id, alsoExclude.id]) : new Set([self.id]);
        return aabbOverlapsAnyEntity(aabb, excludeIds, this.entities);
      };

    // --- Phase 1: Move player ---
    if (player.velocity && player.collider) {
      const speedMult = getSpeedMultiplier(player.position, getCollision);
      const { vx, vy } = player.velocity;

      // Detect if player is about to push something — reduce speed
      let pushMult = 1.0;
      if (vx !== 0 || vy !== 0) {
        const playerBox = getEntityAABB(player.position, player.collider);
        const probeBox: AABB = {
          left: playerBox.left + Math.sign(vx),
          top: playerBox.top + Math.sign(vy),
          right: playerBox.right + Math.sign(vx),
          bottom: playerBox.bottom + Math.sign(vy),
        };
        for (const entity of this.entities) {
          if (entity === player || !entity.collider || !entity.wanderAI) continue;
          if (aabbsOverlap(probeBox, getEntityAABB(entity.position, entity.collider))) {
            pushMult = PUSH_PLAYER_SPEED_MULT;
            break;
          }
        }
      }

      const dx = vx * dt * speedMult * pushMult;
      const dy = vy * dt * speedMult * pushMult;
      resolveCollision(player, dx, dy, getCollision, blockMask, makeExtraBlocker(player));
    } else if (player.velocity) {
      player.position.wx += player.velocity.vx * dt;
      player.position.wy += player.velocity.vy * dt;
    }

    // --- Phase 2: Push entities overlapping the player ---
    if (player.collider && player.velocity) {
      const { vx, vy } = player.velocity;
      if (vx !== 0 || vy !== 0) {
        const playerBox = getEntityAABB(player.position, player.collider);
        const len = Math.sqrt(vx * vx + vy * vy);
        const pushSpeed = len * PUSH_SPEED_FRACTION;
        const pushDx = (vx / len) * pushSpeed * dt;
        const pushDy = (vy / len) * pushSpeed * dt;

        for (const entity of this.entities) {
          if (entity === player || !entity.collider || !entity.wanderAI) continue;
          const otherBox = getEntityAABB(entity.position, entity.collider);
          if (!aabbsOverlap(playerBox, otherBox)) continue;
          // Push: resolve against terrain + props + other entities (exclude self AND player)
          resolveCollision(
            entity,
            pushDx,
            pushDy,
            getCollision,
            blockMask,
            makeExtraBlocker(entity, player),
          );
        }
      }
    }

    // --- Phase 3: Move NPCs ---
    for (const entity of this.entities) {
      if (entity === player || !entity.velocity) continue;

      const speedMult = entity.collider ? getSpeedMultiplier(entity.position, getCollision) : 1.0;
      const dx = entity.velocity.vx * dt * speedMult;
      const dy = entity.velocity.vy * dt * speedMult;

      if (entity.collider) {
        const blocked = resolveCollision(
          entity,
          dx,
          dy,
          getCollision,
          blockMask,
          makeExtraBlocker(entity),
        );
        if (blocked && entity.wanderAI) {
          onWanderBlocked(entity);
        }
      } else {
        entity.position.wx += dx;
        entity.position.wy += dy;
      }
    }

    // --- Tick animations ---
    for (const entity of this.entities) {
      const sprite = entity.sprite;
      if (sprite && sprite.frameCount > 1) {
        if (sprite.moving) {
          sprite.animTimer += dt * 1000;
          if (sprite.animTimer >= sprite.frameDuration) {
            sprite.animTimer -= sprite.frameDuration;
            sprite.frameCol = (sprite.frameCol + 1) % sprite.frameCount;
          }
        } else {
          sprite.frameCol = 0;
          sprite.animTimer = 0;
        }
      }
    }
  }

  /** Remove an entity by id. Returns true if found and removed. */
  remove(id: number): boolean {
    const idx = this.entities.findIndex((e) => e.id === id);
    if (idx < 0) return false;
    this.entities.splice(idx, 1);
    return true;
  }

  /** Return entities sorted by Y position for depth ordering. */
  getYSorted(): Entity[] {
    return [...this.entities].sort(
      (a, b) => a.position.wy + (a.sortOffsetY ?? 0) - (b.position.wy + (b.sortOffsetY ?? 0)),
    );
  }
}

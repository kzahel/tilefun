import { CHUNK_SIZE_PX } from "../config/constants.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import type { AABB } from "./collision.js";
import {
  aabbOverlapsAnyEntity,
  aabbOverlapsPropWalls,
  aabbsOverlap,
  getEntityAABB,
  getSpeedMultiplier,
  resolveCollision,
  separateOverlappingEntities,
} from "./collision.js";
import type { Entity } from "./Entity.js";
import type { PropManager } from "./PropManager.js";
import { SpatialHash } from "./SpatialHash.js";
import { onWanderBlocked } from "./wanderAI.js";

/** Player speed multiplier while pushing an entity. */
const PUSH_PLAYER_SPEED_MULT = 0.5;

export class EntityManager {
  readonly entities: Entity[] = [];
  readonly spatialHash = new SpatialHash();
  private nextId = 1;

  /** Optional hook for TagServiceImpl to receive tag change notifications. */
  tagChangeHook?: {
    onAdd: (entity: Entity, tag: string) => void;
    onRemove: (entity: Entity, tag: string) => void;
  };

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
    this.spatialHash.insert(entity);
    return entity;
  }

  /**
   * Update all entities: apply velocity with collision, tick animation.
   * @param entityTickDts If provided, only entities in this map are ticked,
   *   using their per-entity dt (accumulated from tick tiering).
   *   Entities not in the map are frozen. If omitted, all entities tick with `dt`.
   */
  update(
    dt: number,
    getCollision: (tx: number, ty: number) => number,
    player: Entity,
    propManager: PropManager,
    entityTickDts?: ReadonlyMap<Entity, number>,
  ): void {
    // Save previous positions for render interpolation (only for ticking entities)
    for (const entity of this.entities) {
      if (entityTickDts && !entityTickDts.has(entity)) continue;
      entity.prevPosition = { wx: entity.position.wx, wy: entity.position.wy };
    }
    // Player may not be in this.entities (it's passed separately)
    player.prevPosition = { wx: player.position.wx, wy: player.position.wy };

    const blockMask = CollisionFlag.Solid | CollisionFlag.Water;

    // Helper: check if an AABB overlaps any prop's wall segments (or single collider)
    const overlapsAnyProp = (aabb: AABB): boolean => {
      const minCx = Math.floor(aabb.left / CHUNK_SIZE_PX);
      const maxCx = Math.floor(aabb.right / CHUNK_SIZE_PX);
      const minCy = Math.floor(aabb.top / CHUNK_SIZE_PX);
      const maxCy = Math.floor(aabb.bottom / CHUNK_SIZE_PX);
      for (const prop of propManager.getPropsInChunkRange(minCx, minCy, maxCx, maxCy)) {
        if (aabbOverlapsPropWalls(aabb, prop.position, prop)) {
          return true;
        }
      }
      return false;
    };

    // Helper: build extra-blocker for resolveCollision (props + other entities).
    // Uses spatial hash for nearby entity lookups instead of scanning all entities.
    const makeExtraBlocker =
      (self: Entity, alsoExclude?: Entity) =>
      (aabb: AABB): boolean => {
        if (overlapsAnyProp(aabb)) return true;
        const excludeIds = alsoExclude ? new Set([self.id, alsoExclude.id]) : new Set([self.id]);
        const minCx = Math.floor(aabb.left / CHUNK_SIZE_PX);
        const maxCx = Math.floor(aabb.right / CHUNK_SIZE_PX);
        const minCy = Math.floor(aabb.top / CHUNK_SIZE_PX);
        const maxCy = Math.floor(aabb.bottom / CHUNK_SIZE_PX);
        const nearby = this.spatialHash.queryRange(minCx, minCy, maxCx, maxCy);
        return aabbOverlapsAnyEntity(aabb, excludeIds, nearby);
      };

    // --- Phase 1: Push entities in player's path, then move player ---
    if (player.velocity && player.collider) {
      const speedMult = getSpeedMultiplier(player.position, getCollision);
      const { vx, vy } = player.velocity;

      // Detect pushable entities adjacent to player in movement direction.
      // pushFactor = dot(velocity dir, player→entity dir): 1 when walking
      // straight into the entity, 0 when perpendicular — lets the player
      // slide off entities they're barely touching.
      const toPush: { entity: Entity; pushFactor: number }[] = [];
      if (vx !== 0 || vy !== 0) {
        const playerBox = getEntityAABB(player.position, player.collider);
        const probeBox: AABB = {
          left: playerBox.left + Math.sign(vx),
          top: playerBox.top + Math.sign(vy),
          right: playerBox.right + Math.sign(vx),
          bottom: playerBox.bottom + Math.sign(vy),
        };
        const velLen = Math.sqrt(vx * vx + vy * vy);
        const playerCx = (playerBox.left + playerBox.right) / 2;
        const playerCy = (playerBox.top + playerBox.bottom) / 2;
        // Use spatial hash to find nearby entities instead of scanning all
        const probMinCx = Math.floor(probeBox.left / CHUNK_SIZE_PX);
        const probMaxCx = Math.floor(probeBox.right / CHUNK_SIZE_PX);
        const probMinCy = Math.floor(probeBox.top / CHUNK_SIZE_PX);
        const probMaxCy = Math.floor(probeBox.bottom / CHUNK_SIZE_PX);
        const nearbyEntities = this.spatialHash.queryRange(
          probMinCx,
          probMinCy,
          probMaxCx,
          probMaxCy,
        );
        for (const entity of nearbyEntities) {
          if (entity === player || !entity.collider || !entity.wanderAI) continue;
          const entityBox = getEntityAABB(entity.position, entity.collider);
          if (!aabbsOverlap(probeBox, entityBox)) continue;
          const toDirX = (entityBox.left + entityBox.right) / 2 - playerCx;
          const toDirY = (entityBox.top + entityBox.bottom) / 2 - playerCy;
          const toDirLen = Math.sqrt(toDirX * toDirX + toDirY * toDirY);
          if (toDirLen === 0) continue;
          const dot = (vx / velLen) * (toDirX / toDirLen) + (vy / velLen) * (toDirY / toDirLen);
          const pushFactor = Math.max(0, dot);
          if (pushFactor > 0) toPush.push({ entity, pushFactor });
        }
      }

      // Slow the player proportional to the strongest push
      const maxPushFactor = toPush.reduce((m, p) => Math.max(m, p.pushFactor), 0);
      const pushMult = 1.0 - (1.0 - PUSH_PLAYER_SPEED_MULT) * maxPushFactor;
      const dx = vx * dt * speedMult * pushMult;
      const dy = vy * dt * speedMult * pushMult;

      // Pre-push: move entities proportional to how directly the player walks into them.
      // If the entity is against a wall it stays put and the player is blocked.
      for (const { entity, pushFactor } of toPush) {
        resolveCollision(
          entity,
          dx * pushFactor,
          dy * pushFactor,
          getCollision,
          blockMask,
          makeExtraBlocker(entity, player),
        );
      }

      // Now move the player — entities are still solid blockers.
      resolveCollision(player, dx, dy, getCollision, blockMask, makeExtraBlocker(player));
    } else if (player.velocity) {
      player.position.wx += player.velocity.vx * dt;
      player.position.wy += player.velocity.vy * dt;
    }

    // --- Phase 3: Move NPCs (using per-entity tick dt when available) ---
    for (const entity of this.entities) {
      if (entity === player || !entity.velocity) continue;
      if (entityTickDts && !entityTickDts.has(entity)) continue;

      const entityDt = entityTickDts?.get(entity) ?? dt;
      const speedMult = entity.collider ? getSpeedMultiplier(entity.position, getCollision) : 1.0;
      const dx = entity.velocity.vx * entityDt * speedMult;
      const dy = entity.velocity.vy * entityDt * speedMult;

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

    // Update spatial hash after all movement (player + NPCs)
    for (const entity of this.entities) {
      this.spatialHash.update(entity);
    }

    // --- Phase 4: Separate overlapping entities ---
    separateOverlappingEntities(this.entities, player, dt, getCollision, blockMask);

    // --- Tick animations (only for ticking entities) ---
    for (const entity of this.entities) {
      if (entityTickDts && !entityTickDts.has(entity)) continue;
      const sprite = entity.sprite;
      if (sprite && sprite.frameCount > 1) {
        const entityDt = entityTickDts?.get(entity) ?? dt;
        if (sprite.moving) {
          sprite.animTimer += entityDt * 1000;
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
    const entity = this.entities[idx];
    if (entity) this.spatialHash.remove(entity);
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

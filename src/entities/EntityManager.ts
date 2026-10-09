import {
  CHUNK_SIZE_PX,
  DEFAULT_PHYSICAL_HEIGHT,
  STEP_UP_THRESHOLD,
  TILE_SIZE,
} from "../config/constants.js";
import { zRangesOverlap } from "../physics/AABB3D.js";
import {
  applyGroundTracking,
  isElevationBlocked3D,
  resolveGroundZForTracking,
} from "../physics/surfaceHeight.js";
import { prepareMallardFlight, settleMallard } from "../wildlife/mallardInteractions.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import type { AABB } from "./collision.js";
import {
  aabbLacksWater,
  aabbOverlapsAnyEntity,
  aabbOverlapsPropWalls,
  aabbsOverlap,
  getEntityAABB,
  getSpeedMultiplier,
  resolveCollision,
  separateOverlappingEntities,
} from "./collision.js";
import type { Entity } from "./Entity.js";
import { ENTITY_DEFS } from "./EntityDefs.js";
import type { PropManager } from "./PropManager.js";
import { SpatialHash } from "./SpatialHash.js";
import { tickSpriteAnimation } from "./spriteAnimation.js";
import { onWanderBlocked } from "./wanderAI.js";

/** Player speed multiplier while pushing an entity. */
const PUSH_PLAYER_SPEED_MULT = 0.5;

export class EntityManager {
  canPlace?: (wx: number, wy: number) => boolean;
  canSpawn?: (entity: Entity) => boolean;
  beforeSpawn?: (entity: Entity) => void;
  onSpawn?: (entity: Entity) => void;
  onDespawn?: (entity: Entity, destroyed: boolean) => void;
  onRemove?: (entity: Entity) => void;
  readonly entities: Entity[] = [];
  simulationEntities: readonly Entity[] | undefined;
  onMutation?: (entity: Entity) => void;
  readonly removalListeners = new Set<(entity: Entity, destroyed: boolean) => void>();
  get queryEntities(): readonly Entity[] {
    return this.simulationEntities ?? this.entities;
  }
  readonly byId = new Map<number, Entity>();
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
    this.beforeSpawn?.(entity);
    entity.id = this.nextId++;
    this.entities.push(entity);
    this.byId.set(entity.id, entity);
    this.spatialHash.insert(entity);
    this.onSpawn?.(entity);
    return entity;
  }

  /** Restore a detached entity with its existing identity (for an aborted realm transfer). */
  restore(entity: Entity): void {
    if (this.entities.some((existing) => existing.id === entity.id))
      throw new Error(`Entity ${entity.id} is already present.`);
    this.entities.push(entity);
    this.byId.set(entity.id, entity);
    this.spatialHash.insert(entity);
    this.nextId = Math.max(this.nextId, entity.id + 1);
  }

  /**
   * Update all entities: apply velocity with collision, tick animation.
   * @param players One or more player entities. In local mode this is a
   *   single-element array; in multiplayer it contains all active players.
   * @param entityTickDts If provided, only entities in this map are ticked,
   *   using their per-entity dt (accumulated from tick tiering).
   *   Entities not in the map are frozen. If omitted, all entities tick with `dt`.
   * @param skipEntityIds Optional entity IDs to freeze for this update pass.
   */
  update(
    dt: number,
    getCollision: (tx: number, ty: number) => number,
    players: readonly Entity[],
    propManager: PropManager,
    entityTickDts?: ReadonlyMap<Entity, number>,
    getHeight?: (tx: number, ty: number) => number,
    skipEntityIds?: ReadonlySet<number>,
  ): void {
    const playerSet = new Set(players);
    const active = entityTickDts ? [...entityTickDts.keys()] : this.entities;

    // Save previous positions for render interpolation (only for ticking entities)
    for (const entity of active) {
      if (entityTickDts && !entityTickDts.has(entity)) continue;
      entity.prevPosition = { wx: entity.position.wx, wy: entity.position.wy };
    }
    // Players may not be in this.entities (they're passed separately)
    for (const player of players) {
      player.prevPosition = { wx: player.position.wx, wy: player.position.wy };
    }

    const blockMask = CollisionFlag.Solid | CollisionFlag.Water;

    // Helper: check if an AABB overlaps any prop's wall segments (or single collider)
    const overlapsAnyProp = (aabb: AABB, entityWz?: number, entityHeight?: number): boolean => {
      const minCx = Math.floor(aabb.left / CHUNK_SIZE_PX);
      const maxCx = Math.floor(aabb.right / CHUNK_SIZE_PX);
      const minCy = Math.floor(aabb.top / CHUNK_SIZE_PX);
      const maxCy = Math.floor(aabb.bottom / CHUNK_SIZE_PX);
      for (const prop of propManager.getPropsInChunkRange(minCx, minCy, maxCx, maxCy)) {
        if (aabbOverlapsPropWalls(aabb, prop.position, prop, entityWz, entityHeight)) {
          return true;
        }
      }
      return false;
    };

    // Helper: build extra-blocker for resolveCollision (props + other entities).
    // Uses spatial hash for nearby entity lookups instead of scanning all entities.
    // When self is airborne (jumping), small entities (spriteHeight <= 32) are skipped.
    const makeExtraBlocker =
      (self: Entity, alsoExclude?: Entity) =>
      (aabb: AABB): boolean => {
        const selfWz = self.wz ?? 0;
        const selfHeight = self.collider?.physicalHeight ?? DEFAULT_PHYSICAL_HEIGHT;
        if (overlapsAnyProp(aabb, selfWz, selfHeight)) return true;
        if (getHeight) {
          // Airborne entities can't step up — must be above terrain to pass
          const elevStepUp = self.jumpVZ !== undefined ? 0 : STEP_UP_THRESHOLD;
          if (isElevationBlocked3D(aabb, selfWz, getHeight, elevStepUp)) return true;
        }
        const excludeIds = alsoExclude ? new Set([self.id, alsoExclude.id]) : new Set([self.id]);
        const minCx = Math.floor(aabb.left / CHUNK_SIZE_PX);
        const maxCx = Math.floor(aabb.right / CHUNK_SIZE_PX);
        const minCy = Math.floor(aabb.top / CHUNK_SIZE_PX);
        const maxCy = Math.floor(aabb.bottom / CHUNK_SIZE_PX);
        let nearby = this.spatialHash.queryRange(minCx, minCy, maxCx, maxCy);
        // 3D entity-entity filtering: skip entities whose Z ranges don't overlap with ours
        nearby = nearby.filter((e) => {
          if (e.parentId === self.id) return false; // children (e.g. rider) don't block parent
          const eWz = e.wz ?? 0;
          const eHeight = e.collider?.physicalHeight ?? DEFAULT_PHYSICAL_HEIGHT;
          return zRangesOverlap(selfWz, selfHeight, eWz, eHeight);
        });
        return aabbOverlapsAnyEntity(aabb, excludeIds, nearby);
      };

    // --- Phase 1: Push entities in each player's path, then move players ---
    // Player velocity is already friction/acceleration-adjusted — no speedMult needed.
    for (const player of players) {
      if (skipEntityIds?.has(player.id)) continue;
      if (player.velocity && player.collider) {
        const { vx, vy } = player.velocity;

        // Detect pushable entities adjacent to player in movement direction.
        const toPush: { entity: Entity; pushFactor: number }[] = [];
        const playerWz = player.wz ?? 0;
        const playerPhysH = player.collider.physicalHeight ?? DEFAULT_PHYSICAL_HEIGHT;
        if (vx !== 0 || vy !== 0) {
          const playerBox = getEntityAABB(player.position, player.collider);
          const probeX = Math.max(1, Math.abs(vx * dt)) * Math.sign(vx);
          const probeY = Math.max(1, Math.abs(vy * dt)) * Math.sign(vy);
          const probeBox: AABB = {
            left: playerBox.left + probeX,
            top: playerBox.top + probeY,
            right: playerBox.right + probeX,
            bottom: playerBox.bottom + probeY,
          };
          const velLen = Math.sqrt(vx * vx + vy * vy);
          const playerCx = (playerBox.left + playerBox.right) / 2;
          const playerCy = (playerBox.top + playerBox.bottom) / 2;
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
            if (
              entity === player ||
              !entity.collider ||
              entity.collider.solid === false ||
              !entity.wanderAI ||
              (entityTickDts && !entityTickDts.has(entity))
            )
              continue;
            // Skip push if Z ranges don't overlap
            const eWz = entity.wz ?? 0;
            const eH = entity.collider.physicalHeight ?? DEFAULT_PHYSICAL_HEIGHT;
            if (!zRangesOverlap(playerWz, playerPhysH, eWz, eH)) continue;
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
        const dx = vx * dt * pushMult;
        const dy = vy * dt * pushMult;

        // Pre-push: move entities proportional to how directly the player walks into them.
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
        // Airborne players can fly over water tiles (land-in-water respawns them).
        const playerMask = player.jumpVZ !== undefined ? CollisionFlag.Solid : blockMask;
        resolveCollision(player, dx, dy, getCollision, playerMask, makeExtraBlocker(player));
      } else if (player.velocity) {
        player.position.wx += player.velocity.vx * dt;
        player.position.wy += player.velocity.vy * dt;
      }
    }

    // --- Phase 2: Move NPCs (using per-entity tick dt when available) ---
    for (const entity of active) {
      if (playerSet.has(entity) || !entity.velocity) continue;
      if (skipEntityIds?.has(entity.id)) continue;
      if (entity.parentId !== undefined) continue; // parented: position derived from parent
      if (entity.tags?.has("projectile")) continue; // projectiles handled by BallPhysics
      if (entityTickDts && !entityTickDts.has(entity)) continue;

      const entityDt = entityTickDts?.get(entity) ?? dt;
      if (entity.mallard?.state === "flight") prepareMallardFlight(entity, entityDt);
      const isAquatic = ENTITY_DEFS[entity.type]?.aquatic === true;
      const isAmphibious = ENTITY_DEFS[entity.type]?.amphibious === true;
      const speedMult =
        entity.collider && !isAquatic && !isAmphibious
          ? getSpeedMultiplier(entity.position, getCollision)
          : 1.0;
      const dx = entity.velocity.vx * entityDt * speedMult;
      const dy = entity.velocity.vy * entityDt * speedMult;

      if (entity.collider) {
        // Aquatic entities: blocked by Solid only (water is passable),
        // plus an extra check that every tile under their AABB has water.
        const entityBlockMask = isAquatic || isAmphibious ? CollisionFlag.Solid : blockMask;
        const baseBlocker = makeExtraBlocker(entity);
        const extraBlocker = isAquatic
          ? (aabb: AABB): boolean => {
              if (baseBlocker(aabb)) return true;
              return aabbLacksWater(aabb, getCollision);
            }
          : baseBlocker;
        const blocked = resolveCollision(
          entity,
          dx,
          dy,
          getCollision,
          entityBlockMask,
          extraBlocker,
        );
        if (blocked && entity.wanderAI) {
          onWanderBlocked(entity);
        }
      } else {
        entity.position.wx += dx;
        entity.position.wy += dy;
      }
    }

    // --- Phase 2.5: Ground tracking — snap wz to surface, detect cliff edges ---
    if (getHeight) {
      const computeGroundZ = (e: Entity): number => {
        const footprint = e.collider ? getEntityAABB(e.position, e.collider) : null;
        const minCx = Math.floor((footprint?.left ?? e.position.wx) / CHUNK_SIZE_PX);
        const maxCx = Math.floor((footprint?.right ?? e.position.wx) / CHUNK_SIZE_PX);
        const minCy = Math.floor((footprint?.top ?? e.position.wy) / CHUNK_SIZE_PX);
        const maxCy = Math.floor((footprint?.bottom ?? e.position.wy) / CHUNK_SIZE_PX);
        return resolveGroundZForTracking(
          e,
          getHeight,
          propManager.getPropsInChunkRange(minCx, minCy, maxCx, maxCy),
          this.spatialHash.queryRange(minCx, minCy, maxCx, maxCy),
        );
      };

      for (const entity of active) {
        if (entityTickDts && !entityTickDts.has(entity)) continue;
        if (skipEntityIds?.has(entity.id)) continue;
        if (entity.parentId !== undefined) continue; // riders: Z is visual-only
        if (entity.tags?.has("projectile")) continue; // projectiles handled by BallPhysics
        if (entity.mallard?.state === "flight" && entity.mallard.flight) {
          if (entity.mallard.flight.elapsed >= entity.mallard.flight.duration)
            settleMallard(
              entity,
              computeGroundZ(entity),
              (getCollision(
                Math.floor(entity.position.wx / TILE_SIZE),
                Math.floor(entity.position.wy / TILE_SIZE),
              ) &
                CollisionFlag.Water) !==
                0,
            );
          continue;
        }
        applyGroundTracking(entity, computeGroundZ(entity), playerSet.has(entity));
      }
      // Also initialize players that may not be in this.entities
      for (const player of players) {
        if (skipEntityIds?.has(player.id)) continue;
        if (player.parentId !== undefined) continue; // riders: Z is visual-only
        applyGroundTracking(player, computeGroundZ(player), true);
      }
    }

    // Update spatial hash after all movement (players + NPCs)
    for (const entity of active) {
      this.spatialHash.update(entity);
    }

    // --- Phase 3: Separate overlapping entities (skip parented) ---
    const unparentedEntities = active.filter(
      (e) => e.parentId === undefined && !skipEntityIds?.has(e.id),
    );
    separateOverlappingEntities(
      unparentedEntities,
      playerSet,
      dt,
      getCollision,
      blockMask,
      entityTickDts,
    );

    // --- Phase 4: Resolve parented entity positions ---
    this.resolveParentedPositions(players, active);
    for (const entity of active) this.spatialHash.update(entity);

    // --- Phase 5: Tick animations (only for ticking entities) ---
    for (const entity of active) {
      if (entityTickDts && !entityTickDts.has(entity)) continue;
      tickSpriteAnimation(entity, entityTickDts?.get(entity) ?? dt);
    }
  }

  /**
   * Resolve world positions for entities with a parentId.
   * Processes parent-first (topological order) to support nesting.
   * Auto-detaches children whose parent no longer exists.
   */
  resolveParentedPositions(
    players: readonly Entity[],
    active: readonly Entity[] = this.entities,
  ): void {
    const allEntities = [...new Set([...active, ...players])];
    const byId = new Map(allEntities.map((entity) => [entity.id, entity]));
    let remaining = allEntities.filter((entity) => entity.parentId !== undefined).length;
    if (!remaining) return;
    const resolved = new Set<number>();

    // Admission caps nesting at 32; order does not depend on runtime allocation.
    for (let pass = 0; pass < 32 && remaining > 0; pass++) {
      for (const e of allEntities) {
        if (e.parentId === undefined || resolved.has(e.id)) continue;
        const parent = byId.get(e.parentId);
        if (!parent) {
          // Parent removed — auto-detach
          Reflect.set(e, "parentId", undefined);
          Reflect.set(e, "localOffsetX", undefined);
          Reflect.set(e, "localOffsetY", undefined);
          remaining--;
          continue;
        }
        // Only resolve if parent is unparented or already resolved this tick
        if (parent.parentId !== undefined && !resolved.has(parent.id)) continue;

        e.position.wx = parent.position.wx + (e.localOffsetX ?? 0);
        e.position.wy = parent.position.wy + (e.localOffsetY ?? 0);
        // Track rider Z to mount's surface + ride offset (jumpZ stores the offset)
        if (parent.wz !== undefined && e.jumpZ !== undefined) {
          e.wz = parent.wz + e.jumpZ;
        }
        if (parent.groundZ !== undefined) {
          e.groundZ = parent.groundZ;
        }
        resolved.add(e.id);
        remaining--;
      }
    }
  }

  /** Remove an entity by id. Returns true if found and removed. */
  remove(id: number, persist = true): boolean {
    const idx = this.entities.findIndex((e) => e.id === id);
    if (idx < 0) return false;
    const entity = this.entities[idx];
    if (entity) {
      this.spatialHash.remove(entity);
      this.onDespawn?.(entity, persist);
      for (const listener of this.removalListeners) listener(entity, persist);
      if (persist) this.onRemove?.(entity);
    }
    this.entities.splice(idx, 1);
    this.byId.delete(id);
    return true;
  }

  /** Return entities sorted by Y position for depth ordering. */
  getYSorted(): Entity[] {
    return [...this.entities].sort(
      (a, b) => a.position.wy + (a.sortOffsetY ?? 0) - (b.position.wy + (b.sortOffsetY ?? 0)),
    );
  }
}

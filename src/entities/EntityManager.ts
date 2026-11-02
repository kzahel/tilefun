import { prepareDeerTravel, settleDeer } from "../wildlife/deerInteractions.js";
import { prepareFaunaTravel, settleFauna, syncFaunaWater } from "../wildlife/faunaInteractions.js";
import { FROG_HOP_DURATION, prepareFrogHop, settleFrog } from "../wildlife/frogInteractions.js";
import { prepareMallardFlight, settleMallard } from "../wildlife/mallardInteractions.js";
import { preparePredatorFlight, settlePredatorFlight } from "../wildlife/PredatorMotion.js";
import {
  prepareRabbitHop,
  RABBIT_HOP_DURATION,
  settleRabbit,
} from "../wildlife/rabbitInteractions.js";
import { prepareRobinMotion, settleRobin } from "../wildlife/robinInteractions.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import { CollisionIndex } from "./CollisionIndex.js";
import type { Entity } from "./Entity.js";
import { SpatialHash } from "./SpatialHash.js";
import { setSpriteClipElapsed, tickSpriteAnimation } from "./spriteAnimation.js";
import { onWanderBlocked } from "./wanderAI.js";

export class EntityManager {
  readonly wildlifeRespawns = new Map<
    string,
    import("../wildlife/WildlifeRespawns.js").PendingWildlifeRespawn
  >();
  onWildlifeRespawnChanged?: (
    id: string,
    job: import("../wildlife/WildlifeRespawns.js").PendingWildlifeRespawn | undefined,
  ) => void;
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
  readonly collisionIndex = new CollisionIndex();
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
    if (entity.velocity) entity.desiredVelocity ??= { vx: 0, vy: 0 };
    entity.id = this.nextId++;
    this.entities.push(entity);
    this.byId.set(entity.id, entity);
    this.spatialHash.insert(entity);
    this.onSpawn?.(entity);
    this.collisionIndex.update(entity);
    return entity;
  }

  /** Restore a detached entity with its existing identity (for an aborted realm transfer). */
  restore(entity: Entity): void {
    if (this.entities.some((existing) => existing.id === entity.id))
      throw new Error(`Entity ${entity.id} is already present.`);
    this.entities.push(entity);
    this.byId.set(entity.id, entity);
    this.spatialHash.insert(entity);
    this.collisionIndex.update(entity);
    this.nextId = Math.max(this.nextId, entity.id + 1);
  }

  /** Species/AI produce intent, never an independently committed physical pose. */
  collectMotionIntents(
    active: readonly Entity[],
    dt: number,
    getCollision: (x: number, y: number) => number,
  ) {
    const intents = new Map<number, import("../physics/PhysicsScene.js").MotionIntent>();
    for (const entity of active) {
      if (this.byId.get(entity.id) !== entity || entity.parentId !== undefined) continue;
      const oldZ = entity.wz;
      if (entity.mallard?.state === "flight") prepareMallardFlight(entity, dt);
      if (entity.deer?.motion) prepareDeerTravel(entity, dt);
      if (entity.fauna)
        syncFaunaWater(
          entity,
          (getCollision(Math.floor(entity.position.wx / 16), Math.floor(entity.position.wy / 16)) &
            CollisionFlag.Water) !==
            0,
        );
      if (entity.fauna?.actionElapsed !== undefined) entity.fauna.actionElapsed += dt;
      if (entity.fauna?.motion) prepareFaunaTravel(entity, dt);
      if (entity.predator?.flight) preparePredatorFlight(entity, dt);
      if (entity.robin?.motion) prepareRobinMotion(entity, dt);
      if (entity.rabbit?.state === "hop") prepareRabbitHop(entity, dt);
      if (entity.frog?.state === "hop") prepareFrogHop(entity, dt);
      const velocity = entity.desiredVelocity;
      const targetZ = entity.wz;
      if (oldZ === undefined) delete entity.wz;
      else entity.wz = oldZ;
      if (!velocity) continue;
      const intent: import("../physics/PhysicsScene.js").MotionIntent = {
        vx: velocity.vx,
        vy: velocity.vy,
      };
      // Existing authored travel curves become a vertical target for the shared motor.
      if (targetZ !== oldZ && targetZ !== undefined) intent.altitude = targetZ;
      intents.set(entity.id, intent);
    }
    return intents;
  }

  /** After one shared readback: gameplay completion, derived attachments and animation. */
  finishPhysics(
    active: readonly Entity[],
    players: readonly Entity[],
    dt: number,
    getCollision: (x: number, y: number) => number,
  ) {
    for (const e of active) {
      // Ordinary wanderers reverse their next intent when a wall blocks travel.
      // Specialized species retain their own decision/arrival policies.
      const wanted = Math.hypot(e.desiredVelocity?.vx ?? 0, e.desiredVelocity?.vy ?? 0);
      if (
        e.wanderAI &&
        !e.fauna &&
        !e.mallard &&
        !e.frog &&
        !e.rabbit &&
        !e.deer &&
        !e.robin &&
        !e.predator &&
        wanted > 1 &&
        Math.hypot(e.velocity?.vx ?? 0, e.velocity?.vy ?? 0) < wanted * 0.1
      )
        onWanderBlocked(e);
      const z = e.groundZ ?? e.wz ?? 0;
      const water =
        (getCollision(Math.floor(e.position.wx / 16), Math.floor(e.position.wy / 16)) &
          CollisionFlag.Water) !==
        0;
      if (e.mallard?.flight && e.mallard.flight.elapsed >= e.mallard.flight.duration)
        settleMallard(e, z, water);
      if (e.frog?.hop && e.frog.hop.elapsed >= FROG_HOP_DURATION) settleFrog(e, z, water);
      if (e.rabbit?.hop && e.rabbit.hop.elapsed >= RABBIT_HOP_DURATION) settleRabbit(e, z);
      if (e.deer?.motion && e.deer.motion.elapsed >= e.deer.motion.duration) settleDeer(e);
      if (e.fauna?.motion && e.fauna.motion.elapsed >= e.fauna.motion.duration) settleFauna(e, z);
      if (e.robin?.motion && e.robin.motion.elapsed >= e.robin.motion.duration) settleRobin(e, z);
      if (e.predator?.flight && e.predator.flight.elapsed >= e.predator.flight.duration)
        settlePredatorFlight(e, z);
    }
    this.resolveParentedPositions(players, active);
    for (const entity of active) {
      this.spatialHash.update(entity);
      if (entity.fauna?.motion || entity.fauna?.actionElapsed !== undefined)
        setSpriteClipElapsed(
          entity,
          Math.round((entity.fauna.motion?.elapsed ?? entity.fauna.actionElapsed ?? 0) * 1000),
        );
      else if (entity.deer?.motion)
        setSpriteClipElapsed(entity, Math.round(entity.deer.motion.elapsed * 1000));
      else if (entity.robin?.motion)
        setSpriteClipElapsed(entity, Math.round(entity.robin.motion.elapsed * 1000));
      else if (entity.frog?.hop)
        setSpriteClipElapsed(entity, Math.round(entity.frog.hop.elapsed * 1000));
      else if (entity.rabbit?.hop)
        setSpriteClipElapsed(entity, Math.round(entity.rabbit.hop.elapsed * 1000));
      else tickSpriteAnimation(entity, dt);
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
    // A live parent may be outside the ordinary actor tick set (for example a
    // railway-owned carriage). Resolve attachments without advancing that body.
    const attached = new Set([...active, ...players]);
    for (const entity of attached) {
      let parent = this.byId.get(entity.parentId ?? -1);
      for (let depth = 0; parent && depth < 32 && !attached.has(parent); depth++) {
        attached.add(parent);
        parent = this.byId.get(parent.parentId ?? -1);
      }
    }
    const allEntities = [...attached];
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
          // Parent removed â€” auto-detach
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
      this.collisionIndex.remove(entity);
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

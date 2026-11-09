import { CHUNK_SIZE_PX } from "../config/constants.js";
import { performanceMetrics } from "../diagnostics/PerformanceMetrics.js";
import type { Entity } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import type { Prop } from "../entities/Prop.js";
import type { PropManager } from "../entities/PropManager.js";
import { isTrain } from "../railway/Train.js";
import {
  type ActorRecord,
  actorRecordJson,
  actorScope,
  decodeActor,
  durableId,
} from "./ActorRecords.js";
import type { SaveEntry } from "./PersistenceStore.js";
import type { SaveManager } from "./SaveManager.js";

/** Continuous actor state (motion, AI timers) reaches storage within this period. */
export const SWEEP_SECONDS = 10;

interface Membership {
  scope: string;
  cx: number;
  cy: number;
  parent: number | undefined;
}

export interface FeatureRecord {
  id: string;
  scope: string;
  deleted: boolean;
  actor?: boolean;
  edit?: { type: string; wx: number; wy: number; proceduralId: string };
}

/**
 * Shared actor lifecycle -> dirty records. Discrete changes (spawn, despawn, edits,
 * attachment, chunk crossings) are marked as they happen; continuous state is found
 * by a round-robin sweep that compares each record with its last written string, and
 * by full sweeps at explicit save barriers. Actors stay plain objects.
 */
export class RealmRecords {
  private hydrating = false;
  acceptsRecord?: (record: ActorRecord) => boolean;
  private origins = new WeakMap<Entity | Prop, string>();
  readonly byId = new Map<string, Entity | Prop>();
  readonly features = new Map<string, FeatureRecord>();
  readonly buckets = new Map<string, Set<Entity | Prop>>();
  /** Spatial membership/attachment changes, independent of ordinary saved state edits. */
  membershipRevision = 0;
  private membership = new Map<Entity | Prop, Membership>();
  /** Last record string captured for writing (or restored from storage). */
  private written = new WeakMap<Entity | Prop, string>();
  private sweepQueue: (Entity | Prop)[] = [];
  private sweepCredit = 0;
  private children = new Map<number, Set<Entity>>();
  private parentOf = new WeakMap<Entity, number>();
  private readonly dirtySnapshots = new WeakMap<
    Entity | Prop,
    { key: string; snapshot: () => SaveEntry }
  >();

  root(actor: Entity | Prop): Entity | Prop {
    if ("isProp" in actor || actor.parentId === undefined) return actor;
    let root = actor;
    const seen = new Set<number>();
    while (!("isProp" in root) && root.parentId !== undefined) {
      if (seen.has(root.id)) throw new Error("Cyclic actor attachment.");
      seen.add(root.id);
      const parent = this.entities.byId.get(root.parentId);
      if (!parent || parent.type === "player") break;
      root = parent;
    }
    return root;
  }

  projectedPosition(actor: Entity | Prop): { wx: number; wy: number } {
    let current = actor,
      dx = 0,
      dy = 0;
    const seen = new Set<number>();
    while (!("isProp" in current) && current.parentId !== undefined) {
      if (seen.has(current.id) || seen.size >= 32) throw new Error("Invalid attachment chain.");
      seen.add(current.id);
      const parent = this.entities.byId.get(current.parentId);
      if (!parent) break;
      dx += current.localOffsetX ?? 0;
      dy += current.localOffsetY ?? 0;
      current = parent;
    }
    return { wx: current.position.wx + dx, wy: current.position.wy + dy };
  }
  scope(actor: Entity | Prop): string {
    return actorScope(this.root(actor).position);
  }
  get isHydrating(): boolean {
    return this.hydrating;
  }
  group(actor: Entity): Entity[] {
    const root = this.root(actor);
    if ("isProp" in root) return [actor];
    const result: Entity[] = [],
      queue = [root];
    while (queue.length) {
      const current = queue.pop();
      if (!current) break;
      if (result.length >= 64 || result.includes(current))
        throw new Error("Attachment group exceeds its limit.");
      result.push(current);
      queue.push(...(this.children.get(current.id) ?? []));
    }
    return result;
  }

  private unindex(actor: Entity | Prop): void {
    const old = this.membership.get(actor);
    if (old) {
      this.membershipRevision++;
      const bucket = this.buckets.get(old.scope);
      bucket?.delete(actor);
      if (!bucket?.size) this.buckets.delete(old.scope);
      this.membership.delete(actor);
    }
    if (!("isProp" in actor)) {
      const parent = this.parentOf.get(actor);
      if (parent !== undefined) {
        const children = this.children.get(parent);
        children?.delete(actor);
        if (!children?.size) this.children.delete(parent);
        this.parentOf.delete(actor);
      }
    }
  }

  private index(actor: Entity | Prop): void {
    const { position } = this.root(actor);
    const cx = Math.floor(position.wx / CHUNK_SIZE_PX),
      cy = Math.floor(position.wy / CHUNK_SIZE_PX);
    const parent = "isProp" in actor ? undefined : actor.parentId;
    const old = this.membership.get(actor);
    if (old && old.cx === cx && old.cy === cy && old.parent === parent) return;
    this.unindex(actor);
    const scope = `${cx},${cy}`;
    const bucket = this.buckets.get(scope) ?? new Set();
    this.buckets.set(scope, bucket);
    bucket.add(actor);
    this.membership.set(actor, { scope, cx, cy, parent });
    this.membershipRevision++;
    if (!("isProp" in actor) && actor.parentId !== undefined) {
      const children = this.children.get(actor.parentId) ?? new Set();
      this.children.set(actor.parentId, children);
      children.add(actor);
      this.parentOf.set(actor, actor.parentId);
    }
  }

  constructor(
    readonly entities: EntityManager,
    readonly props: PropManager,
    readonly saves: SaveManager,
    readonly definitions?: import("./ActorRecords.js").ActorDefinitions,
  ) {
    saves.beforeFlush = (scope) => (scope === undefined ? this.sweepAll() : this.sweepScope(scope));
    entities.onMutation = (entity) => this.changed(entity);
    entities.onSpawn = (entity) => {
      if (
        entity.type === "player" ||
        entity.type.startsWith("vehicle-v1:") ||
        isTrain(entity) ||
        entity.tags?.has("parking-visit")
      )
        return;
      this.attach(entity);
      if (!this.hydrating) {
        this.changed(entity);
        if (entity.proceduralId) this.feature(entity, false, true);
      }
    };
    entities.onDespawn = (entity, destroyed) => {
      if (!entity.persistentId) return;
      this.byId.delete(entity.persistentId);
      this.unindex(entity);
      if (destroyed) {
        for (const child of [...(this.children.get(entity.id) ?? [])]) {
          Reflect.set(child, "parentId", undefined);
          Reflect.set(child, "localOffsetX", undefined);
          Reflect.set(child, "localOffsetY", undefined);
          this.changed(child);
        }
        this.remove("entities", entity.persistentId);
        if (entity.proceduralId) this.feature(entity, true, true);
      }
    };
    props.onAdd = (prop) => {
      if (!this.origins.has(prop)) this.origins.set(prop, actorScope(prop.position));
      if (!prop.proceduralId || prop.persistentId) {
        this.attach(prop);
        if (!this.hydrating) this.changed(prop);
      }
    };
    props.onDespawn = (prop) => {
      if (prop.persistentId) this.byId.delete(prop.persistentId);
      this.unindex(prop);
    };
    props.onChange = (prop, deleted) => {
      if (prop.proceduralId) this.feature(prop, deleted);
      if (deleted) {
        if (prop.persistentId) {
          this.byId.delete(prop.persistentId);
          this.remove("props", prop.persistentId);
        }
      } else {
        this.attach(prop);
        this.changed(prop);
      }
    };
  }

  private attach(actor: Entity | Prop): void {
    this.byId.set(durableId(actor), actor);
    this.index(actor);
    if (!this.origins.has(actor)) this.origins.set(actor, actorScope(actor.position));
  }

  /**
   * Once per authority tick: refresh chunk membership, marking crossings and
   * attachment changes at once, then compare a slice of records so every actor is
   * checked once per SWEEP_SECONDS.
   */
  tick(dt: number): void {
    const timing = performanceMetrics.start();
    this.refreshMembership();
    this.sweepCredit = Math.min(
      this.sweepCredit + (this.byId.size * dt) / SWEEP_SECONDS,
      this.byId.size,
    );
    while (this.sweepCredit >= 1) {
      // Rebuild when exhausted or mostly stale (after a large unload), so the
      // remaining actors keep their once-per-period cadence.
      if (!this.sweepQueue.length || this.sweepQueue.length > 2 * this.byId.size)
        this.sweepQueue = [...this.byId.values()];
      const actor = this.sweepQueue.pop();
      if (!actor) break;
      if (!this.current(actor)) continue; // stale entries spend no credit
      this.sweepCredit--;
      this.sweep(actor);
    }
    performanceMetrics.end("realm.saveSweep", timing);
  }

  /** Save barrier: every actor whose record differs from its last write is marked dirty. */
  sweepAll(): void {
    this.refreshMembership();
    for (const actor of this.byId.values()) this.sweep(actor);
  }

  /** Release barrier for one chunk's actors; true when all match their last write. */
  sweepScope(scope: string): boolean {
    this.refreshMembership();
    let clean = true;
    for (const actor of this.buckets.get(scope) ?? []) clean = !this.sweep(actor) && clean;
    return clean;
  }

  private refreshMembership(): void {
    for (const [actor, old] of this.membership) {
      const parent = "isProp" in actor ? undefined : actor.parentId;
      if (parent !== old.parent) {
        // Carry, attach and detach are discrete edits: save them promptly.
        this.changed(actor);
        continue;
      }
      const { position } = parent === undefined ? actor : this.root(actor);
      if (
        Math.floor(position.wx / CHUNK_SIZE_PX) !== old.cx ||
        Math.floor(position.wy / CHUNK_SIZE_PX) !== old.cy
      ) {
        this.index(actor);
        this.markDirty(actor);
      }
    }
  }

  /** Marks the actor's record when it differs from the last write; true if marked. */
  private sweep(actor: Entity | Prop): boolean {
    if (!this.current(actor)) return false;
    if (this.recordJson(actor) === this.written.get(actor)) return false;
    this.markDirty(actor);
    return true;
  }

  private current(actor: Entity | Prop): boolean {
    return !!actor.persistentId && this.byId.get(actor.persistentId) === actor;
  }

  private recordJson(actor: Entity | Prop): string {
    return actorRecordJson(
      actor,
      "parentId" in actor ? this.entities.byId.get(actor.parentId ?? -1) : undefined,
    );
  }

  changed(actor: Entity | Prop): void {
    if (!actor.persistentId || !this.byId.has(actor.persistentId)) return;
    this.index(actor);
    this.markDirty(actor);
    if (!("isProp" in actor))
      for (const child of [...(this.children.get(actor.id) ?? [])]) this.changed(child);
  }

  private markDirty(actor: Entity | Prop): void {
    if (!actor.persistentId) return;
    const collection = "isProp" in actor ? "props" : "entities";
    const key = actor.persistentId;
    let cached = this.dirtySnapshots.get(actor);
    if (!cached || cached.key !== key) {
      cached = {
        key,
        snapshot: () => {
          const json = this.recordJson(actor);
          this.written.set(actor, json);
          return {
            collection,
            key,
            scope: this.scope(actor),
            value: {
              ...(JSON.parse(json) as ActorRecord),
              ...(actor.proceduralId ? { originScope: this.origins.get(actor) } : {}),
            },
          };
        },
      };
      this.dirtySnapshots.set(actor, cached);
    }
    this.saves.markRecordDirty(collection, key, cached.snapshot);
  }

  private remove(collection: string, key: string): void {
    this.saves.markRecordDirty(collection, key, () => ({
      collection,
      key,
      value: undefined,
      deleted: true,
    }));
  }

  private feature(actor: Entity | Prop, deleted: boolean, dynamic = false): void {
    const id = actor.proceduralId;
    if (!id) return;
    const scope = this.origins.get(actor) ?? actorScope(actor.position);
    const record: FeatureRecord = {
      id,
      scope,
      deleted,
      ...(dynamic ? { actor: true } : {}),
      ...(!dynamic && !deleted
        ? { edit: { type: actor.type, ...actor.position, proceduralId: id } }
        : {}),
    };
    this.features.set(id, record);
    this.saves.markRecordDirty("features", id, () => ({
      collection: "features",
      key: id,
      scope,
      value: record,
    }));
  }

  restore(records: Iterable<ActorRecord>): void {
    const parents: { entity: Entity; parent: string }[] = [];
    const restored: (Entity | Prop)[] = [];
    this.hydrating = true;
    try {
      for (const record of records) {
        if (this.byId.has(record.persistentId) || this.acceptsRecord?.(record) === false) continue;
        const actor = decodeActor(record, this.definitions);
        restored.push(actor);
        if (record.originScope) this.origins.set(actor, record.originScope);
        if ("isProp" in actor) this.props.add(actor);
        else {
          this.entities.spawn(actor);
          if (record.parent) parents.push({ entity: actor, parent: record.parent });
        }
      }
      for (const { entity, parent } of parents) {
        const target = this.byId.get(parent);
        if (!target || "isProp" in target)
          throw new Error("Saved attachment target is unavailable.");
        entity.parentId = target.id;
        this.index(entity);
      }
      for (const { entity } of parents) this.index(entity);
      // The stored record is the baseline: loading writes nothing until an actor changes.
      for (const actor of restored) this.written.set(actor, this.recordJson(actor));
    } finally {
      this.hydrating = false;
    }
  }
}

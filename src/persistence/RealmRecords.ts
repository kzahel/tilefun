import type { Entity } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import type { Prop } from "../entities/Prop.js";
import type { PropManager } from "../entities/PropManager.js";
import {
  type ActorRecord,
  actorScope,
  decodeActor,
  durableId,
  encodeActor,
  observeActor,
} from "./ActorRecords.js";
import type { SaveManager } from "./SaveManager.js";

export interface FeatureRecord {
  id: string;
  scope: string;
  deleted: boolean;
  actor?: boolean;
  edit?: { type: string; wx: number; wy: number; proceduralId: string };
}

/** Shared actor lifecycle -> dirty records. Never enumerates actors to save metadata. */
export class RealmRecords {
  private hydrating = false;
  private observed = new WeakSet<Entity | Prop>();
  private origins = new WeakMap<Entity | Prop, string>();
  readonly byId = new Map<string, Entity | Prop>();
  readonly features = new Map<string, FeatureRecord>();
  readonly buckets = new Map<string, Set<Entity | Prop>>();
  private membership = new WeakMap<Entity | Prop, string>();
  private children = new Map<number, Set<Entity>>();
  private parentOf = new WeakMap<Entity, number>();

  root(actor: Entity | Prop): Entity | Prop {
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
      const bucket = this.buckets.get(old);
      bucket?.delete(actor);
      if (!bucket?.size) this.buckets.delete(old);
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
    const scope = this.scope(actor);
    if (
      this.membership.get(actor) === scope &&
      ("isProp" in actor || this.parentOf.get(actor) === actor.parentId)
    )
      return;
    this.unindex(actor);
    const bucket = this.buckets.get(scope) ?? new Set();
    this.buckets.set(scope, bucket);
    bucket.add(actor);
    this.membership.set(actor, scope);
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
  ) {
    entities.onMutation = (entity) => this.changed(entity);
    entities.onSpawn = (entity) => {
      if (entity.type === "player" || entity.type.startsWith("vehicle-v1:")) return;
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
    if (this.observed.has(actor)) return;
    this.observed.add(actor);
    observeActor(actor, () => {
      if (!this.hydrating && this.byId.has(durableId(actor))) this.changed(actor);
    });
  }

  changed(actor: Entity | Prop): void {
    if (!actor.persistentId || !this.byId.has(actor.persistentId)) return;
    this.index(actor);
    const collection = "isProp" in actor ? "props" : "entities";
    const key = actor.persistentId;
    this.saves.markRecordDirty(collection, key, () => ({
      collection,
      key,
      scope: this.scope(actor),
      value: {
        ...encodeActor(
          actor,
          "parentId" in actor ? this.entities.byId.get(actor.parentId ?? -1) : undefined,
        ),
        ...(actor.proceduralId ? { originScope: this.origins.get(actor) } : {}),
      },
    }));
    if (!("isProp" in actor))
      for (const child of [...(this.children.get(actor.id) ?? [])]) this.changed(child);
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
    this.hydrating = true;
    try {
      for (const record of records) {
        if (this.byId.has(record.persistentId)) continue;
        const actor = decodeActor(record);
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
    } finally {
      this.hydrating = false;
    }
  }
}

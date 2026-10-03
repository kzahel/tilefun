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

  constructor(
    readonly entities: EntityManager,
    readonly props: PropManager,
    readonly saves: SaveManager,
  ) {
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
      if (destroyed) {
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
    if (!this.origins.has(actor)) this.origins.set(actor, actorScope(actor.position));
    if (this.observed.has(actor)) return;
    this.observed.add(actor);
    observeActor(actor, () => {
      if (!this.hydrating && this.byId.has(durableId(actor))) this.changed(actor);
    });
  }

  changed(actor: Entity | Prop): void {
    if (!actor.persistentId || !this.byId.has(actor.persistentId)) return;
    const collection = "isProp" in actor ? "props" : "entities";
    const key = actor.persistentId;
    this.saves.markRecordDirty(collection, key, () => ({
      collection,
      key,
      scope: actorScope(actor.position),
      value: encodeActor(
        actor,
        "parentId" in actor
          ? this.entities.entities.find((e) => e.id === actor.parentId)
          : undefined,
      ),
    }));
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
      }
    } finally {
      this.hydrating = false;
    }
  }
}

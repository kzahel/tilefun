import { CHUNK_SIZE_PX, RENDER_DISTANCE } from "../config/constants.js";
import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import type { PropManager } from "../entities/PropManager.js";
import { type ActorRecord, actorScope, decodeActor } from "../persistence/ActorRecords.js";
import { PERSISTENCE_BUDGET } from "../persistence/PersistenceBudget.js";
import type { FeatureRecord, RealmRecords } from "../persistence/RealmRecords.js";
import type { SavedChunkData, SaveManager } from "../persistence/SaveManager.js";
import type { TrafficRecords } from "../persistence/TrafficRecords.js";
import type { SavedTraffic } from "../traffic/TrafficSystem.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import type { World } from "../world/World.js";
import { ChunkResidency } from "./ChunkResidency.js";
import { around, type ChunkDemand, InterestManager } from "./InterestManager.js";
import type { PlayerSession } from "./PlayerSession.js";

interface ChunkPayload {
  terrain: SavedChunkData | undefined;
  actors: ActorRecord[];
  features: FeatureRecord[];
  seeded: boolean;
  traffic: SavedTraffic[];
}

/** Shared authority lifecycle, independent of Worker/Node and the durable executor. */
export class RealmStreaming {
  readonly interest = new InterestManager();
  readonly residency: ChunkResidency<ChunkPayload>;
  demand = new Map<string, ChunkDemand>();
  private request = 0;
  private closed = false;
  constructor(
    readonly world: World,
    readonly records: RealmRecords,
    readonly props: PropManager,
    readonly saves: SaveManager,
    readonly hydrateFeatures: (records: FeatureRecord[]) => void,
    readonly forgetFeatures: (records: FeatureRecord[], key: string) => void,
    readonly generate: (key: string, seeded: boolean) => void,
    readonly traffic?: TrafficRecords,
  ) {
    world.chunks.managed = true;
    this.residency = new ChunkResidency({
      canLoad: () =>
        !saves.pressured &&
        records.entities.entities.length < PERSISTENCE_BUDGET.actors &&
        props.props.length < PERSISTENCE_BUDGET.props,
      load: async (key) => {
        const [terrain, entities, props, features, origin, vehicles] = await Promise.all([
          saves.loadChunk(key),
          saves.loadRecords("entities", key),
          saves.loadRecords("props", key),
          saves.loadRecords("features", key),
          saves.store.get("actorOrigins", key),
          saves.loadRecords("traffic", key),
        ]);
        const actors = [...entities.values(), ...props.values()] as ActorRecord[];
        // Validate complete groups before publishing any live objects.
        const byId = new Map(actors.map((actor) => [actor.persistentId, actor]));
        if (byId.size !== actors.length) throw new Error("Duplicate durable actor identity.");
        const groups = new Map<string, number>();
        for (const actor of actors) {
          decodeActor(actor);
          const seen = new Set<string>([actor.persistentId]);
          let root = actor;
          while (root.parent) {
            if (seen.has(root.parent) || seen.size >= 32)
              throw new Error("Invalid saved attachment chain.");
            seen.add(root.parent);
            const parent = byId.get(root.parent);
            if (!parent || parent.kind !== "entity")
              throw new Error("Incomplete saved attachment group.");
            root = parent;
          }
          const count = (groups.get(root.persistentId) ?? 0) + 1;
          if (count > 64) throw new Error("Saved attachment group exceeds its limit.");
          groups.set(root.persistentId, count);
        }

        return {
          terrain,
          actors,
          features: [...features.values()] as FeatureRecord[],
          seeded: !!origin,
          traffic: [...vehicles.values()] as SavedTraffic[],
        };
      },
      publish: (key, payload) => {
        if (
          records.entities.entities.length +
            payload.actors.filter(
              (actor) => actor.kind === "entity" && !records.byId.has(actor.persistentId),
            ).length +
            payload.traffic.length >
            PERSISTENCE_BUDGET.actors ||
          props.props.length +
            payload.actors.filter(
              (actor) => actor.kind === "prop" && !records.byId.has(actor.persistentId),
            ).length >
            PERSISTENCE_BUDGET.props
        )
          throw new Error("Actor residency budget exceeded.");
        const [cx = 0, cy = 0] = key.split(",").map(Number);
        traffic?.validate(payload.traffic);
        const oldEntities = new Set(records.entities.byId.keys()),
          oldProps = new Set(props.props.map((p) => p.id)),
          oldFeatures = new Map(records.features);
        saves.publishing(() => {
          try {
            world.chunks.admit(cx, cy, payload.terrain);
            for (const feature of payload.features) records.features.set(feature.id, feature);
            hydrateFeatures(payload.features);
            records.restore(payload.actors);
            traffic?.restore(payload.traffic);
            generate(key, payload.seeded);
            if (!payload.seeded)
              saves.markRecordDirty("actorOrigins", key, () => ({
                collection: "actorOrigins",
                key,
                scope: key,
                value: { seeded: true },
              }));
          } catch (error) {
            for (const actor of [...records.entities.entities])
              if (!oldEntities.has(actor.id)) records.entities.remove(actor.id, false);
            for (const prop of [...props.props])
              if (!oldProps.has(prop.id)) props.remove(prop.id, false);
            forgetFeatures(
              [...records.features.values()].filter((f) => !oldFeatures.has(f.id)),
              key,
            );
            records.features.clear();
            for (const [id, feature] of oldFeatures) records.features.set(id, feature);
            hydrateFeatures([...oldFeatures.values()].filter((f) => f.scope === key));
            world.chunks.remove(key);
            throw error;
          }
        });
      },
      save: () => saves.flushSnapshot(),
      canRelease: (key) =>
        !saves.dirtyInScope(key) &&
        !records.entities.entities.some(
          (e) =>
            e.type === "player" && (actorScope(e.position) === key || records.scope(e) === key),
        ),
      release: (key) => {
        traffic?.release(key);
        for (const actor of [...(records.buckets.get(key) ?? [])]) {
          if ("isProp" in actor) props.remove(actor.id, false);
          else records.entities.remove(actor.id, false);
        }
        // Pure generated props have no durable actor identity.
        for (const prop of [...props.props])
          if (
            !prop.persistentId &&
            prop.proceduralId !== "interior:boundary" &&
            actorScope(prop.position) === key
          )
            props.remove(prop.id, false);
        const features = [...records.features.values()].filter((f) => f.scope === key);
        forgetFeatures(features, key);
        for (const feature of features) records.features.delete(feature.id);
        world.chunks.remove(key);
        for (const feature of records.features.values()) {
          const [fx = 0, fy = 0] = feature.scope.split(",").map(Number);
          if (!world.chunks.get(fx, fy)) records.features.delete(feature.id);
        }
      },
    });
  }

  update(ranges: readonly ChunkRange[], sessions: Iterable<PlayerSession>): void {
    this.interest.set(
      "observers",
      ranges.map((range) => ({
        range: {
          minCx: range.minCx - RENDER_DISTANCE,
          minCy: range.minCy - RENDER_DISTANCE,
          maxCx: range.maxCx + RENDER_DISTANCE,
          maxCy: range.maxCy + RENDER_DISTANCE,
        },
        activity: 0,
        reason: "observer",
      })),
    );
    const owners = new Set<string>();
    for (const session of sessions) {
      if (session.retired || session.transitioning) continue;
      const owner = `player:${session.clientId}`;
      owners.add(owner);
      const cx = Math.floor(session.player.position.wx / CHUNK_SIZE_PX);
      const cy = Math.floor(session.player.position.wy / CHUNK_SIZE_PX);
      const parent = this.records.entities.byId.get(session.player.parentId ?? -1);
      const root = parent ? this.records.root(parent) : undefined;
      this.interest.set(owner, [
        ...(root
          ? [
              {
                range: around(
                  Math.floor(root.position.wx / CHUNK_SIZE_PX),
                  Math.floor(root.position.wy / CHUNK_SIZE_PX),
                  1,
                ),
                activity: 2 as const,
                reason: "dependency" as const,
              },
            ]
          : []),
        { range: around(cx, cy, 5), activity: 0, reason: "dependency" },
        { range: around(cx, cy, 4), activity: session.debugPaused ? 0 : 1, reason: "player" },
        { range: around(cx, cy, 2), activity: session.debugPaused ? 0 : 2, reason: "player" },
      ]);
    }
    this.interest.retainOwners(owners, "player:");
    const active = this.interest.demand(Date.now());
    this.interest.set("attachments", recordsDependencyTickets(this.records, active));
    this.pump();
  }
  private pump(): void {
    this.demand = this.interest.demand(Date.now());
    this.residency.reconcile(this.demand);
  }
  rangeReady(range: ChunkRange): boolean {
    for (let cy = range.minCy; cy <= range.maxCy; cy++)
      for (let cx = range.minCx; cx <= range.maxCx; cx++)
        if (!this.residency.ready(`${cx},${cy}`)) return false;
    return true;
  }
  async ensure(range: ChunkRange): Promise<void> {
    if (this.closed) throw new Error("Realm is closing.");
    const owner = `arrival:${++this.request}`;
    this.interest.set(owner, [{ range, activity: 0, reason: "arrival" }]);
    this.pump();
    try {
      await this.residency.settle();
      for (let cy = range.minCy; cy <= range.maxCy; cy++)
        for (let cx = range.minCx; cx <= range.maxCx; cx++)
          if (!this.residency.ready(`${cx},${cy}`))
            throw new Error("World data is not ready.", { cause: this.residency.error });
    } finally {
      // Brief handoff lease bridges async arrival to the session's next demand update.
      this.interest.set(owner, [
        { range, activity: 0, reason: "arrival", expires: Date.now() + 1000 },
      ]);
    }
  }
  supported(entity: Entity | Prop, dt = 1 / 60): boolean {
    const p = this.records.projectedPosition(entity),
      c = entity.collider,
      root = this.records.root(entity);
    const reach = Math.max(
      32,
      Math.abs(("velocity" in entity ? entity.velocity?.vx : 0) ?? 0) * dt,
      Math.abs(("velocity" in entity ? entity.velocity?.vy : 0) ?? 0) * dt,
      Math.abs(("velocity" in root ? root.velocity?.vx : 0) ?? 0) * dt,
      Math.abs(("velocity" in root ? root.velocity?.vy : 0) ?? 0) * dt,
      c?.width ?? 0,
      c?.height ?? 0,
    );
    const minCx = Math.floor((p.wx - reach) / CHUNK_SIZE_PX),
      maxCx = Math.floor((p.wx + reach) / CHUNK_SIZE_PX);
    const minCy = Math.floor((p.wy - reach) / CHUNK_SIZE_PX),
      maxCy = Math.floor((p.wy + reach) / CHUNK_SIZE_PX);
    for (let cy = minCy; cy <= maxCy; cy++)
      for (let cx = minCx; cx <= maxCx; cx++)
        if (!this.residency.ready(`${cx},${cy}`)) return false;
    return true;
  }
  resume(): void {
    this.closed = false;
    this.residency.resume();
  }
  async close(): Promise<void> {
    this.closed = true;
    await this.residency.close();
  }
}

function recordsDependencyTickets(records: RealmRecords, demand: Map<string, ChunkDemand>) {
  const keys = new Set<string>();
  for (const [scope, actors] of records.buckets) {
    if (!demand.get(scope)?.activity) continue;
    for (const actor of actors)
      if ("parentId" in actor && actor.parentId !== undefined)
        keys.add(actorScope(records.projectedPosition(actor)));
  }
  return [...keys].map((key) => {
    const [cx = 0, cy = 0] = key.split(",").map(Number);
    return { range: around(cx, cy, 1), activity: 0 as const, reason: "dependency" as const };
  });
}

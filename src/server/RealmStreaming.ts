import { CHUNK_SIZE_PX, RENDER_DISTANCE } from "../config/constants.js";
import type { Entity } from "../entities/Entity.js";
import type { PropManager } from "../entities/PropManager.js";
import { type ActorRecord, actorScope, decodeActor } from "../persistence/ActorRecords.js";
import type { FeatureRecord, RealmRecords } from "../persistence/RealmRecords.js";
import type { SavedChunkData, SaveManager } from "../persistence/SaveManager.js";
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
  ) {
    world.chunks.managed = true;
    this.residency = new ChunkResidency({
      load: async (key) => {
        const [terrain, entities, props, features, origin] = await Promise.all([
          saves.loadChunk(key),
          saves.loadRecords("entities", key),
          saves.loadRecords("props", key),
          saves.loadRecords("features", key),
          saves.store.get("actorOrigins", key),
        ]);
        const actors = [...entities.values(), ...props.values()] as ActorRecord[];
        // Validate a complete group before publishing any live objects.
        const ids = new Set(actors.map((actor) => actor.persistentId));
        for (const actor of actors) {
          decodeActor(actor);
          const seen = new Set<string>([actor.persistentId]);
          let parent = actor.parent;
          while (parent) {
            if (seen.has(parent) || seen.size > 32)
              throw new Error("Invalid saved attachment chain.");
            seen.add(parent);
            parent = actors.find((candidate) => candidate.persistentId === parent)?.parent;
          }
          if (actor.parent && !ids.has(actor.parent) && !records.byId.has(actor.parent))
            throw new Error("Incomplete saved attachment group.");
        }
        return {
          terrain,
          actors,
          features: [...features.values()] as FeatureRecord[],
          seeded: !!origin,
        };
      },
      publish: (key, payload) => {
        const [cx = 0, cy = 0] = key.split(",").map(Number);
        world.chunks.admit(cx, cy, payload.terrain);
        for (const feature of payload.features) records.features.set(feature.id, feature);
        hydrateFeatures(payload.features);
        records.restore(payload.actors);
        generate(key, payload.seeded);
        if (!payload.seeded)
          saves.markRecordDirty("actorOrigins", key, () => ({
            collection: "actorOrigins",
            key,
            scope: key,
            value: { seeded: true },
          }));
      },
      save: () => saves.flushSnapshot(),
      canRelease: (key) =>
        !saves.dirtyInScope(key) &&
        !records.entities.entities.some(
          (e) => e.type === "player" && actorScope(e.position) === key,
        ),
      release: (key) => {
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
      this.interest.set(owner, [
        { range: around(cx, cy, 5), activity: 0, reason: "dependency" },
        { range: around(cx, cy, 4), activity: session.debugPaused ? 0 : 1, reason: "player" },
        { range: around(cx, cy, 2), activity: session.debugPaused ? 0 : 2, reason: "player" },
      ]);
    }
    this.interest.retainOwners(owners, "player:");
    this.pump();
  }
  private pump(): void {
    this.demand = this.interest.demand(Date.now());
    this.residency.reconcile(this.demand);
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
  supported(entity: Entity, dt = 1 / 60): boolean {
    const p = entity.position,
      c = entity.collider;
    const reach = Math.max(
      32,
      Math.abs(entity.velocity?.vx ?? 0) * dt,
      Math.abs(entity.velocity?.vy ?? 0) * dt,
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
  async close(): Promise<void> {
    this.closed = true;
    await this.residency.close();
  }
}

import type { SavedTraffic, TrafficState, TrafficSystem } from "../traffic/TrafficSystem.js";
import { actorScope, durableId } from "./ActorRecords.js";
import type { RealmRecords } from "./RealmRecords.js";
import type { SaveManager } from "./SaveManager.js";

/** Traffic uses the same durable transaction/holder policy with its own route codec. */
export class TrafficRecords {
  private origins = new WeakMap<TrafficState, string>();
  constructor(
    readonly traffic: TrafficSystem,
    readonly records: RealmRecords,
    readonly saves: SaveManager,
  ) {
    traffic.managed = true;
    traffic.onChange = (state, destroyed) => this.changed(state, destroyed);
    traffic.onRestore = (state, record) => {
      if (!record.persistentId || !record.originScope)
        throw new Error("Invalid durable traffic identity.");
      state.entity.persistentId = record.persistentId;
      this.origins.set(state, record.originScope);
    };
  }
  private changed(state: TrafficState, destroyed: boolean): void {
    const key = durableId(state.entity);
    const origin = this.origins.get(state) ?? actorScope(state.entity.position);
    this.origins.set(state, origin);
    const identity = state.entity.proceduralId;
    if (!identity) throw new Error("Traffic origin identity is missing.");
    if (!this.records.features.has(identity) || destroyed) {
      const feature = { id: identity, scope: origin, actor: true, deleted: destroyed };
      this.records.features.set(identity, feature);
      this.saves.markRecordDirty("features", identity, () => ({
        collection: "features",
        key: identity,
        scope: origin,
        value: feature,
      }));
    }
    this.saves.markRecordDirty("traffic", key, () =>
      destroyed
        ? { collection: "traffic", key, deleted: true, value: undefined }
        : {
            collection: "traffic",
            key,
            scope: actorScope(state.entity.position),
            value: {
              ...this.traffic.snapshot(state),
              persistentId: key,
              originScope: origin,
            },
          },
    );
  }
  validate(records: readonly SavedTraffic[]): void {
    if (records.length + this.traffic.states.size > 1024)
      throw new Error("Traffic residency budget exceeded.");
    for (const record of records)
      if (
        !record.persistentId ||
        !record.originScope ||
        !Number.isFinite(record.wx) ||
        !Number.isFinite(record.wy) ||
        !Number.isFinite(record.speed)
      )
        throw new Error("Invalid durable traffic state.");
    this.traffic.prepareRestore(records);
  }
  restore(records: readonly SavedTraffic[]): void {
    this.validate(records);
    this.traffic.restore(records);
  }
  release(scope: string): void {
    for (const state of this.traffic.states.values())
      if (actorScope(state.entity.position) === scope)
        this.traffic.entities.remove(state.entity.id, false);
  }
}

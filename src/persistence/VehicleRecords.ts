import type { SavedVehicle, VehicleRegistry, VehicleState } from "../traffic/VehicleRegistry.js";
import { actorScope, durableId } from "./ActorRecords.js";
import type { RealmRecords } from "./RealmRecords.js";
import type { SaveManager } from "./SaveManager.js";

/** Independent vehicle poses use the ordinary durable transaction/holder policy.
 * The collection name stays traffic so existing saves remain readable. */
export class VehicleRecords {
  private origins = new WeakMap<VehicleState, string>();
  constructor(
    readonly vehicles: VehicleRegistry,
    readonly records: RealmRecords,
    readonly saves: SaveManager,
  ) {
    vehicles.onChange = (state, destroyed) => this.changed(state, destroyed);
    vehicles.onRestore = (state, record) => {
      if (!record.persistentId || !record.originScope)
        throw new Error("Invalid durable traffic identity.");
      state.entity.persistentId = record.persistentId;
      this.origins.set(state, record.originScope);
    };
  }
  private changed(state: VehicleState, destroyed: boolean): void {
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
              ...this.vehicles.snapshot(state),
              persistentId: key,
              originScope: origin,
            },
          },
    );
  }
  validate(records: readonly SavedVehicle[]): void {
    for (const record of records)
      if (
        !record.persistentId ||
        !record.originScope ||
        !Number.isFinite(record.wx) ||
        !Number.isFinite(record.wy) ||
        !Number.isFinite(record.wz ?? 0)
      )
        throw new Error("Invalid durable traffic state.");
    this.vehicles.validate(records);
  }
  restore(records: readonly SavedVehicle[]): void {
    this.validate(records);
    this.vehicles.restore(records);
  }
  release(scope: string): void {
    for (const state of this.vehicles.states.values())
      if (actorScope(state.entity.position) === scope)
        this.vehicles.entities.remove(state.entity.id, false);
  }
}

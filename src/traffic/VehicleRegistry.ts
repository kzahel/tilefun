import { BOAT_MODEL } from "../boats/Boat.js";
import { CHUNK_SIZE_PX } from "../config/constants.js";
import {
  aabbOverlapsPropWalls,
  aabbOverlapsSolid,
  aabbsOverlap,
  getEntityAABB,
} from "../entities/collision.js";
import { Direction, type Entity } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import type { PropManager } from "../entities/PropManager.js";
import type { DepotVehicle } from "../generation/regional/VehicleDepotPlanner.js";
import { zRangesOverlap } from "../physics/AABB3D.js";
import type { AngularVelocity, BodyRotation } from "../physics/BodyRotation.js";
import { placementGroundZ } from "../physics/surfaceHeight.js";
import { generateUUID } from "../shared/uuid.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import type { World } from "../world/World.js";
import { validVehicleLightState } from "./EmergencyVehicle.js";
import type { LaneGraph } from "./LaneGraph.js";
import { RoadTraffic } from "./RoadTraffic.js";
import { type TrafficRoute, validTrafficRoute } from "./TrafficRoute.js";
import {
  applyVehicleFacing,
  createVehicle,
  DRIVABLE_MODELS,
  vehicleCardinalHeading,
} from "./Vehicle.js";
import * as Equipment from "./VehicleEquipmentRecords.js";
import { validVehiclePaint } from "./VehiclePaint.js";

/** The old traffic collection remains readable, but route/equipment fields have
 * no runtime owner. Saved poses become independent ordinary shared-world bodies. */
export interface SavedVehicle extends Equipment.SavedEquipment {
  version?: 2;
  identity: string;
  model: string;
  wx: number;
  wy: number;
  wz?: number;
  facing?: number;
  vehicleHeading?: number;
  bodyRotation?: BodyRotation;
  bodyAngularVelocity?: AngularVelocity;
  vx?: number;
  vy?: number;
  vz?: number;
  paintSchemeId?: string;
  emergencyState?: number;
  persistentId?: string;
  originScope?: string;
  autonomous?: boolean;
  route?: TrafficRoute;
}
export interface VehicleState {
  entity: Entity;
  driverId?: number;
  autonomous: boolean;
  route?: TrafficRoute;
}
export interface VehicleSource {
  depotVehicles?(cx: number, cy: number): readonly DepotVehicle[];
  trafficNetwork?(wx: number, wy: number): LaneGraph;
}

/** Lifecycle and persistence only. The shared scene owns every integration and contact. */
export class VehicleRegistry {
  readonly states = new Map<number, VehicleState>();
  readonly traffic = new RoadTraffic(this);
  onChange?: (state: VehicleState, destroyed: boolean) => void;
  onRestore?: (state: VehicleState, record: SavedVehicle) => void;
  canSpawn: (identity: string, wx: number, wy: number) => boolean = () => true;
  constructor(
    readonly world: World,
    readonly entities: EntityManager,
    readonly props: PropManager,
    readonly source: VehicleSource = {},
  ) {
    entities.removalListeners.add((entity, destroyed) => {
      const state = this.states.get(entity.id);
      if (!state) return;
      this.states.delete(entity.id);
      if (destroyed) this.onChange?.(state, true);
    });
  }
  place(
    model: string,
    wx: number,
    wy: number,
    facing = Direction.Right,
    paintSchemeId?: string,
    identity = `placed-vehicle-v1:${generateUUID()}`,
    z?: number,
  ): VehicleState | undefined {
    if (
      !DRIVABLE_MODELS.includes(model) ||
      !validVehiclePaint(model, paintSchemeId) ||
      ![wx, wy, z ?? 0].every((n) => Number.isFinite(n) && Math.abs(n) <= 2 ** 28) ||
      ![Direction.Up, Direction.Down, Direction.Left, Direction.Right].includes(facing) ||
      this.states.size >= 1024
    )
      return;
    const entity = createVehicle(model, wx, wy, facing, paintSchemeId),
      c = entity.collider;
    if (!c) return;
    const bounds = getEntityAABB(entity.position, c);
    for (
      let cy = Math.floor(bounds.top / CHUNK_SIZE_PX);
      cy <= Math.floor((bounds.bottom - 0.001) / CHUNK_SIZE_PX);
      cy++
    )
      for (
        let cx = Math.floor(bounds.left / CHUNK_SIZE_PX);
        cx <= Math.floor((bounds.right - 0.001) / CHUNK_SIZE_PX);
        cx++
      )
        if (!this.world.getChunkIfLoaded(cx, cy)) return;
    // Read-only admission queries choose a spawn; they never integrate a body.
    entity.wz = entity.groundZ =
      z ?? placementGroundZ(entity, (x, y) => this.world.getHeightAt(x, y), this.props.props);
    if (
      aabbOverlapsSolid(
        bounds,
        (x, y) => this.world.getCollisionIfLoaded(x, y),
        model === BOAT_MODEL ? CollisionFlag.Solid : CollisionFlag.Solid | CollisionFlag.Water,
      ) ||
      this.props.props.some((p) =>
        aabbOverlapsPropWalls(bounds, p.position, p, entity.wz, c.physicalHeight ?? 16),
      ) ||
      this.entities.entities.some(
        (other) =>
          other.collider &&
          other.collider.solid !== false &&
          other.parentId === undefined &&
          zRangesOverlap(
            entity.wz ?? 0,
            c.physicalHeight ?? 16,
            other.wz ?? 0,
            other.collider.physicalHeight ?? 16,
          ) &&
          aabbsOverlap(bounds, getEntityAABB(other.position, other.collider)),
      )
    )
      return;
    entity.proceduralId = identity;
    this.entities.spawn(entity);
    const state: VehicleState = { entity, autonomous: false };
    this.states.set(entity.id, state);
    this.onChange?.(state, false);
    return state;
  }
  /** Generated depot models keep their durable identities/tombstones. */
  populate(ranges: readonly ChunkRange[]) {
    const seen = new Set<string>();
    for (const range of ranges)
      for (let cy = range.minCy; cy <= range.maxCy; cy++)
        for (let cx = range.minCx; cx <= range.maxCx; cx++) {
          const key = `${cx},${cy}`;
          if (seen.has(key)) continue;
          seen.add(key);
          for (const p of this.source.depotVehicles?.(cx, cy) ?? []) {
            if (this.states.size >= 1024) return;
            if (
              [...this.states.values()].some((s) => s.entity.proceduralId === p.identity) ||
              !this.canSpawn(p.identity, p.wx, p.wy)
            )
              continue;
            this.place(p.model, p.wx, p.wy, p.facing, undefined, p.identity);
          }
        }
    this.traffic.populate(ranges);
  }
  takeControl(state: VehicleState, playerId: number) {
    state.driverId = playerId;
    delete state.route;
    this.onChange?.(state, false);
  }
  releaseControl(state: VehicleState) {
    delete state.driverId;
    this.onChange?.(state, false);
  }
  snapshot({ entity: e, autonomous, route }: VehicleState): SavedVehicle {
    if (!e.proceduralId) throw Error("Vehicle identity is missing");
    return {
      version: 2,
      identity: e.proceduralId,
      model: e.type.slice(11),
      wx: e.position.wx,
      wy: e.position.wy,
      wz: e.wz ?? 0,
      ...(e.bodyRotation ? { bodyRotation: [...e.bodyRotation] as BodyRotation } : {}),
      ...(e.bodyAngularVelocity
        ? { bodyAngularVelocity: [...e.bodyAngularVelocity] as AngularVelocity }
        : {}),
      facing: e.sprite?.direction ?? Direction.Right,
      vehicleHeading:
        e.vehicleHeading ?? vehicleCardinalHeading(e.sprite?.direction ?? Direction.Right),
      vx: e.velocity?.vx ?? 0,
      vy: e.velocity?.vy ?? 0,
      vz: e.jumpVZ ?? 0,
      autonomous,
      ...(route ? { route: { ...route } } : {}),
      ...(e.paintSchemeId === undefined ? {} : { paintSchemeId: e.paintSchemeId }),
      ...(e.emergencyState === undefined ? {} : { emergencyState: e.emergencyState }),
      ...Equipment.savedEquipment(e),
    };
  }
  save(): SavedVehicle[] {
    return [...this.states.values()].map((s) => this.snapshot(s));
  }
  validate(records: readonly SavedVehicle[]) {
    if (
      records.length > 1024 ||
      records.filter(
        (record) =>
          ![...this.states.values()].some((s) => s.entity.proceduralId === record.identity),
      ).length +
        this.states.size >
        1024
    )
      throw Error("Vehicle residency budget exceeded");
    const identities = new Set<string>();
    for (const record of records) {
      if (
        !record ||
        typeof record.identity !== "string" ||
        !record.identity ||
        record.identity.length > 512 ||
        identities.has(record.identity) ||
        !DRIVABLE_MODELS.includes(record.model) ||
        !validVehiclePaint(record.model, record.paintSchemeId) ||
        (record.autonomous !== undefined && typeof record.autonomous !== "boolean") ||
        (record.route !== undefined && !validTrafficRoute(record.route)) ||
        ![
          record.wx,
          record.wy,
          record.wz ?? 0,
          record.vx ?? 0,
          record.vy ?? 0,
          record.vz ?? 0,
          record.vehicleHeading ?? 0,
          ...(record.bodyRotation ?? []),
          ...(record.bodyAngularVelocity ?? []),
        ].every((n) => Number.isFinite(n) && Math.abs(n) <= 2 ** 28) ||
        (record.bodyRotation !== undefined &&
          (!Array.isArray(record.bodyRotation) ||
            record.bodyRotation.length !== 4 ||
            Math.abs(Math.hypot(...record.bodyRotation) - 1) > 0.01)) ||
        (record.bodyAngularVelocity !== undefined &&
          (!Array.isArray(record.bodyAngularVelocity) ||
            record.bodyAngularVelocity.length !== 3)) ||
        (record.facing !== undefined && ![0, 1, 2, 3].includes(record.facing)) ||
        (record.emergencyState !== undefined &&
          !validVehicleLightState({ type: `vehicle-v1:${record.model}` }, record.emergencyState)) ||
        !Equipment.validSavedEquipment(record.model, record)
      )
        throw Error("Invalid saved vehicle pose, model, paint, lights or bed");
      const existing = [...this.states.values()].find(
        (s) => s.entity.proceduralId === record.identity,
      );
      if (existing && record.persistentId && existing.entity.persistentId !== record.persistentId)
        throw Error("Conflicting saved vehicle identity");
      identities.add(record.identity);
    }
  }
  restore(records: readonly SavedVehicle[]) {
    this.validate(records);
    for (const record of records) {
      if ([...this.states.values()].some((s) => s.entity.proceduralId === record.identity))
        continue;
      const entity = createVehicle(
        record.model,
        record.wx,
        record.wy,
        record.facing ?? Direction.Right,
        record.paintSchemeId,
      );
      entity.proceduralId = record.identity;
      entity.wz = entity.groundZ = record.wz ?? 0;
      entity.velocity = { vx: record.vx ?? 0, vy: record.vy ?? 0 };
      if (record.vz) entity.jumpVZ = record.vz;
      if (record.bodyRotation) entity.bodyRotation = [...record.bodyRotation];
      if (record.bodyAngularVelocity) entity.bodyAngularVelocity = [...record.bodyAngularVelocity];
      if (record.vehicleHeading !== undefined) entity.vehicleHeading = record.vehicleHeading;
      if (record.emergencyState !== undefined) entity.emergencyState = record.emergencyState;
      Equipment.restoreSavedEquipment(entity, record);
      applyVehicleFacing(entity);
      this.entities.spawn(entity);
      const state: VehicleState = {
        entity,
        autonomous: record.autonomous ?? record.identity.startsWith("traffic-v1:"),
        ...(record.route ? { route: { ...record.route } } : {}),
      };
      this.states.set(entity.id, state);
      this.onRestore?.(state, record);
    }
  }
}

import { required } from "../art/ArtCatalog.js";
import { BOAT_MODEL, type BoatPlacement } from "../boats/Boat.js";
import { CHUNK_SIZE_PX } from "../config/constants.js";
import {
  type AABB,
  aabbOverlapsPropWalls,
  aabbsOverlap,
  getEntityAABB,
} from "../entities/collision.js";
import { Direction, type Entity } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import type { PropManager } from "../entities/PropManager.js";
import { actorScope } from "../persistence/ActorRecords.js";
import { querySurfacePatch } from "../physics/SurfacePatch.js";
import { resolveGroundZForTracking } from "../physics/surfaceHeight.js";
import { bridgePart } from "../railway/RoadRailBridge.js";
import { RoadType } from "../road/RoadType.js";
import { generateUUID } from "../shared/uuid.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import type { World } from "../world/World.js";
import { separatesContact } from "./ContactRecovery.js";
import { drivenCarPose } from "./Driving.js";
import { createDrivingQueries, type DrivingQueries } from "./DrivingQueries.js";
import { validVehicleLightState } from "./EmergencyVehicle.js";
import {
  type Lane,
  type LaneGraph,
  nextLanes,
  type Path,
  path,
  samplePath,
  turnPath,
} from "./LaneGraph.js";
import { carryMovingPassengers, planMovingPassengers } from "./MovingSupport.js";
import { ParkingSystem, type SavedParking } from "./ParkingSystem.js";
import { roofSupport } from "./RoofSupport.js";
import { SHOPPING_PARKED_BAYS, type ShoppingCenter, shoppingLot } from "./ShoppingCenter.js";
import { hasVehicleBed } from "./VehicleBed.js";
import { bedInteriorOccupant } from "./VehicleCargo.js";
import { trafficPaint, validVehiclePaint } from "./VehiclePaint.js";
import { commitVehiclePushes, type VehiclePush } from "./VehiclePush.js";

export interface TrafficRouteSource {
  trafficNetwork(wx: number, wy: number): LaneGraph;
  shoppingCenters?(wx: number, wy: number): readonly ShoppingCenter[];
  boats?(cx: number, cy: number): readonly BoatPlacement[];
}

import {
  applyVehicleFacing,
  createVehicle,
  DRIVABLE_MODELS,
  isVehicle,
  TRAFFIC_MODELS,
  vehicleBodySize,
  vehicleCardinalHeading,
  vehicleRoadWidth,
} from "./Vehicle.js";

export const EMPTY_TRAFFIC_ROUTES: TrafficRouteSource = {
  trafficNetwork: () => ({ lanes: new Map(), outgoing: new Map() }),
};

/** A parked placement anchor is bookkeeping, never a generated road or route. */
function placementLane(identity: string, x: number, y: number): Lane {
  const a = { x, y },
    b = { x: x + 1, y };
  return {
    id: identity,
    from: identity,
    to: identity,
    a,
    b,
    direction: Direction.Right,
    width: 0,
    intercity: false,
    path: path([a, b]),
  };
}

export interface SavedTraffic {
  shopping?: { centerId: string; trip: SavedParking };
  shoppingCooldown?: number;
  shoppingTrips?: number;
  placed?: boolean;
  parked?: boolean;
  facing?: number;
  vehicleHeading?: number;
  paintSchemeId?: string;
  /** Qualified hollow-bed profile; missing on older dump records is migrated. */
  vehicleBed?: true;
  resumePath?: Path;
  persistentId?: string;
  originScope?: string;
  wz?: number;
  wx?: number;
  wy?: number;
  speed?: number;
  emergencyState?: number;
  blockedSeconds?: number;
  vx?: number;
  vy?: number;
  identity: string;
  model: string;
  laneId: string;
  nextId: string | null;
  x: number;
  y: number;
  distance: number;
  turning: boolean;
  choices: number;
}
export interface TrafficState {
  shopping?: ParkingSystem;
  shoppingCooldown?: number;
  shoppingTrips?: number;
  placed?: boolean;
  driverId?: number;
  parked?: boolean;
  resumePath?: Path;
  entity: Entity;
  lane: Lane;
  distance: number;
  speed: number;
  next: Lane | undefined;
  turn: Path | undefined;
  reservation: string | undefined;
  waiting: string;
  choices: number;
  blockedSeconds: number;
}
export const TRAFFIC_SPEED = 36,
  TRAFFIC_ACCELERATION = 18,
  TRAFFIC_BRAKE = 64;
function hash(s: string) {
  let n = 0;
  for (const c of s) n = (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0;
  return n;
}
/** Server-owned, bounded traffic. Vehicles are ordinary replicated entities;
 * route state stays authoritative and is disposable outside all player interests. */
export class TrafficSystem {
  managed = false;
  onChange?: (state: TrafficState, destroyed: boolean) => void;
  onRestore?: (state: TrafficState, record: SavedTraffic) => void;
  canSpawn: (identity: string, wx: number, wy: number) => boolean = () => true;
  readonly states = new Map<number, TrafficState>();
  readonly reservations = new Map<string, number>();
  visibleRanges: readonly ChunkRange[] = [];
  settings = { speed: TRAFFIC_SPEED, gap: 12 };
  private visible(x: number, y: number, margin = 96) {
    return this.visibleRanges.some(
      (r) =>
        x + margin >= r.minCx * CHUNK_SIZE_PX &&
        x - margin < (r.maxCx + 1) * CHUNK_SIZE_PX &&
        y + margin >= r.minCy * CHUNK_SIZE_PX &&
        y - margin < (r.maxCy + 1) * CHUNK_SIZE_PX,
    );
  }
  private readonly drivingQueries: DrivingQueries;
  private spawnClock = 0;
  private liveShopping = new Set<ParkingSystem>();
  private retired = new Map<string, number>();
  private time = 0;
  constructor(
    readonly world: World,
    readonly entities: EntityManager,
    readonly props: PropManager,
    readonly strategy: TrafficRouteSource,
  ) {
    this.drivingQueries = createDrivingQueries(props, entities);
    entities.removalListeners.add((entity, destroyed) => {
      const state = this.states.get(entity.id);
      if (!state) return;
      for (const [node, owner] of this.reservations)
        if (owner === entity.id) this.reservations.delete(node);
      state.shopping?.dispose();
      this.states.delete(entity.id);
      if (destroyed) this.onChange?.(state, true);
    });
  }
  identity(model: string, lane: Lane, distance: number): string {
    const pose = samplePath(lane.path, distance);
    return `traffic-v1:${lane.id}:${model}:${actorScope({ wx: pose.x, wy: pose.y })}`;
  }
  add(
    model: string,
    lane: Lane,
    distance = 0,
    persist = true,
    pose = samplePath(lane.path, distance),
    z = 0,
    paintSchemeId?: string,
  ): TrafficState {
    const entity = createVehicle(model, pose.x, pose.y, pose.direction, paintSchemeId);
    entity.wz = entity.groundZ = z;
    entity.proceduralId = this.identity(model, lane, distance);
    this.entities.spawn(entity);
    const s: TrafficState = {
      entity,
      lane,
      distance,
      speed: 0,
      next: undefined,
      turn: undefined,
      reservation: undefined,
      waiting: "starting",
      choices: 0,
      blockedSeconds: 0,
    };
    this.states.set(entity.id, s);
    if (persist) this.onChange?.(s, false);
    return s;
  }
  /** Editor placement uses the same full-body dry-ground checks as driving. */
  place(
    model: string,
    wx: number,
    wy: number,
    facing = Direction.Right,
    paintSchemeId?: string,
  ): TrafficState | undefined {
    if (
      !DRIVABLE_MODELS.includes(model) ||
      !validVehiclePaint(model, paintSchemeId) ||
      ![Direction.Up, Direction.Down, Direction.Left, Direction.Right].includes(facing) ||
      this.states.size >= 1024 ||
      ![wx, wy].every(Number.isFinite) ||
      Math.abs(wx) > 2 ** 28 ||
      Math.abs(wy) > 2 ** 28
    )
      return;
    const candidate = createVehicle(model, wx, wy, facing);
    candidate.id = -1; // Unpublished candidates must not alias the player/entity ID zero.
    const bounds = getEntityAABB(candidate.position, required(candidate.collider));
    for (
      let y = Math.floor(bounds.top / CHUNK_SIZE_PX);
      y <= Math.floor((bounds.bottom - 0.001) / CHUNK_SIZE_PX);
      y++
    )
      for (
        let x = Math.floor(bounds.left / CHUNK_SIZE_PX);
        x <= Math.floor((bounds.right - 0.001) / CHUNK_SIZE_PX);
        x++
      )
        if (!this.world.getChunkIfLoaded(x, y)) return;
    candidate.wz = candidate.groundZ = resolveGroundZForTracking(
      candidate,
      (x, y) => this.world.getHeightAt(x, y),
      this.props.props,
      [],
    );
    if (
      !drivenCarPose(
        candidate,
        { dx: 0, dy: 0 },
        1 / 60,
        this.world,
        this.props.props,
        this.entities.entities,
        this.drivingQueries,
      )
    )
      return;
    const identity = `placed-vehicle-v1:${generateUUID()}`;
    const state = this.add(
      model,
      placementLane(identity, wx, wy),
      0,
      false,
      { x: wx, y: wy, direction: facing },
      candidate.wz,
      paintSchemeId,
    );
    state.entity.proceduralId = identity;
    state.placed = state.parked = true;
    state.waiting = "parked";
    this.onChange?.(state, false);
    return state;
  }
  /** Stable natural moorings use the same durable holders/tombstones as parked cars. */
  private populateBoats(): void {
    if (!this.strategy.boats) return;
    const seen = new Set<string>();
    for (const range of this.visibleRanges)
      for (let cy = range.minCy; cy <= range.maxCy; cy++)
        for (let cx = range.minCx; cx <= range.maxCx; cx++)
          for (const p of this.strategy.boats(cx, cy)) {
            if (seen.has(p.identity) || this.states.size >= 1024) continue;
            seen.add(p.identity);
            if (
              [...this.states.values()].some((s) => s.entity.proceduralId === p.identity) ||
              !this.canSpawn(p.identity, p.wx, p.wy)
            )
              continue;
            const e = createVehicle(BOAT_MODEL, p.wx, p.wy, Direction.Left);
            e.id = -1;
            if (
              !drivenCarPose(
                e,
                { dx: 0, dy: 0 },
                1 / 60,
                this.world,
                this.props.props,
                this.entities.entities,
                this.drivingQueries,
              )
            )
              continue;
            const s = this.add(BOAT_MODEL, placementLane(p.identity, p.wx, p.wy), 0, false, {
              x: p.wx,
              y: p.wy,
              direction: Direction.Left,
            });
            s.entity.proceduralId = p.identity;
            s.placed = s.parked = true;
            s.waiting = "moored";
            this.onChange?.(s, false);
          }
  }
  private network(s: TrafficState): LaneGraph {
    return this.strategy.trafficNetwork(s.entity.position.wx, s.entity.position.wy);
  }
  private choose(s: TrafficState) {
    if (s.next) return;
    const width = vehicleRoadWidth(s.entity.type);
    const graph = this.network(s);
    const choices = nextLanes(graph, s.lane, width).filter(
      (l) => nextLanes(graph, l, width).length > 0,
    );
    // Intercity travel is deliberately occasional; local traffic favors city lanes.
    const local = choices.filter((l) => !l.intercity);
    const pool =
      local.length && hash(`${s.entity.proceduralId}:${s.choices}`) % 8 !== 0 ? local : choices;
    s.next = pool[hash(`${s.lane.id}:${s.entity.proceduralId}:${s.choices}`) % pool.length];
  }
  private pose(s: TrafficState, ahead: number) {
    const p = s.turn ?? s.lane.path,
      d = s.distance + ahead;
    if (d <= p.length) return samplePath(p, d);
    if (s.turn && s.next) return samplePath(s.next.path, d - p.length);
    if (s.next) {
      const turn = turnPath(s.lane, s.next);
      return d - p.length <= turn.length
        ? samplePath(turn, d - p.length)
        : samplePath(s.next.path, d - p.length - turn.length);
    }
    return samplePath(p, p.length);
  }
  private bedPathHeading(s: TrafficState, ahead: number): number {
    // Retain the same continuous yaw for bed contacts, contents and the mesh,
    // including a stopped/reloaded truck. Road admission keeps its existing policy.
    const p = this.pose(s, ahead),
      q = this.pose(s, ahead + 0.01);
    const dx = q.x - p.x,
      dy = q.y - p.y;
    return Math.hypot(dx, dy) > 0.000001
      ? Math.fround(Math.atan2(dy, dx))
      : (s.entity.vehicleHeading ?? vehicleCardinalHeading(p.direction));
  }
  private box(s: TrafficState, ahead: number): AABB {
    const pose = this.pose(s, ahead),
      c = vehicleBodySize(s.entity.type, vehicleCardinalHeading(pose.direction));
    return {
      left: pose.x - c.width / 2,
      right: pose.x + c.width / 2,
      top: pose.y - c.height / 2,
      bottom: pose.y + c.height / 2,
    };
  }
  // Scratch storage for one flat-road car's synchronous lookahead/reservation.
  // Exact coordinates guard direct-map collisions; overwrites only lose reuse.
  private readonly roadProbeX = new Float64Array(256);
  private readonly roadProbeY = new Float64Array(256);
  private readonly roadProbeClear = new Uint8Array(256);
  private roadClear(box: AABB, surfaceFollowing = false, reuseRoad = false) {
    for (let y = Math.floor(box.top / 16); y <= Math.floor((box.bottom - 0.01) / 16); y++)
      for (let x = Math.floor(box.left / 16); x <= Math.floor((box.right - 0.01) / 16); x++) {
        const slot = (x & 15) | ((y & 15) << 4);
        if (
          reuseRoad &&
          this.roadProbeClear[slot] &&
          this.roadProbeX[slot] === x &&
          this.roadProbeY[slot] === y
        )
          continue;
        const road = this.world.getRoadAt(x, y);
        if (
          !road ||
          road === 2 ||
          road === 6 ||
          road === RoadType.RaceCurbRed ||
          road === RoadType.RaceCurbWhite ||
          (!surfaceFollowing &&
            (this.world.getHeightAt(x, y) !== 0 ||
              road === RoadType.RailHorizontalTop ||
              road === RoadType.RailHorizontalBottom))
        )
          return false;
        if (reuseRoad) {
          this.roadProbeX[slot] = x;
          this.roadProbeY[slot] = y;
          this.roadProbeClear[slot] = 1;
        }
      }
    return true;
  }
  /** Conservative level chassis over the highest support under its full footprint.
   * Sample grades continuously so lookahead never chooses an unrelated floor,
   * steps up a wall, or snaps off a missing deck. Clearance uses the resulting Z.
   */
  private surfaceProbe(s: TrafficState, ahead: number): { z: number; reason: string } {
    let z = s.entity.wz ?? 0;
    const riders = this.entities.entities.filter(
      (e) => e !== s.entity && roofSupport(e, [s.entity]),
    );
    const bodyHeight = s.entity.collider?.physicalHeight ?? 24;
    const height = Math.max(
      bodyHeight,
      ...riders.map((e) => bodyHeight + (e.collider?.physicalHeight ?? 0)),
    );
    const steps = Math.max(1, Math.ceil(ahead / 2));
    for (let i = 0; i <= steps; i++) {
      const d = (ahead * i) / steps,
        box = this.box(s, d),
        pose = this.pose(s, d);
      if (!this.roadClear(box, true)) return { z, reason: "road unavailable" };
      const props = this.props.getPropsInChunkRange(
        Math.floor(box.left / CHUNK_SIZE_PX),
        Math.floor(box.top / CHUNK_SIZE_PX),
        Math.floor(box.right / CHUNK_SIZE_PX),
        Math.floor(box.bottom / CHUNK_SIZE_PX),
      );
      for (const region of [
        ...(s.lane.requiredSurfaces ?? []),
        ...(s.next?.requiredSurfaces ?? []),
      ]) {
        if (
          aabbsOverlap(box, region.bounds) &&
          !props.some((p) => p.collider?.surface?.id === region.id)
        )
          return { z, reason: "surface unavailable" };
      }
      const nextZ = resolveGroundZForTracking(
        {
          id: s.entity.id,
          position: { wx: pose.x, wy: pose.y },
          collider: {
            offsetX: 0,
            offsetY: (box.bottom - box.top) / 2,
            width: box.right - box.left,
            height: box.bottom - box.top,
          },
          wz: z,
        },
        (x, y) => this.world.getHeightAt(x, y),
        props,
        [],
      );
      // A road bridge has one legal road level; never spawn/drive on its rails below.
      for (const p of props) {
        const c = p.collider;
        if (!bridgePart(p.type) || !c?.surface) continue;
        const support = querySurfacePatch(c.surface, getEntityAABB(p.position, c), box);
        if (support && nextZ < support.topMax - 0.001) return { z, reason: "unsupported grade" };
      }
      if (Math.abs(nextZ - z) > (i ? (ahead / steps) * 0.5 : 0) + 0.001)
        return { z, reason: "unsupported grade" };
      for (const p of props)
        if (aabbOverlapsPropWalls(box, p.position, p, nextZ, height))
          return { z, reason: "obstacle" };
      for (const e of this.entities.spatialHash.queryRange(
        Math.floor(box.left / CHUNK_SIZE_PX) - 1,
        Math.floor(box.top / CHUNK_SIZE_PX) - 1,
        Math.floor(box.right / CHUNK_SIZE_PX) + 1,
        Math.floor(box.bottom / CHUNK_SIZE_PX) + 1,
      )) {
        if (
          e === s.entity ||
          !e.collider ||
          e.collider.solid === false ||
          e.flashHidden ||
          riders.includes(e) ||
          bedInteriorOccupant(s.entity, e)
        )
          continue;
        const base = e.wz ?? 0;
        if (
          base >= nextZ + height - 0.05 ||
          base + (e.collider.physicalHeight ?? Infinity) <= nextZ + 0.001
        )
          continue;
        if (aabbsOverlap(box, getEntityAABB(e.position, e.collider)))
          return { z, reason: isVehicle(e) ? "traffic" : "crossing" };
      }
      z = nextZ;
    }
    return { z, reason: "" };
  }
  private blocked(s: TrafficState, ahead: number, reuseRoad = false, recovering = false): string {
    if (s.lane.surfaceFollowing) return this.surfaceProbe(s, ahead).reason;
    const box = this.box(s, ahead),
      height = s.entity.collider?.physicalHeight ?? 24;
    if (!this.roadClear(box, false, reuseRoad)) return "road unavailable";
    const props = this.props.getPropsInChunkRange(
      Math.floor(box.left / CHUNK_SIZE_PX),
      Math.floor(box.top / CHUNK_SIZE_PX),
      Math.floor(box.right / CHUNK_SIZE_PX),
      Math.floor(box.bottom / CHUNK_SIZE_PX),
    );
    for (const p of props)
      if (aabbOverlapsPropWalls(box, p.position, p, 0, height)) return "obstacle";
    for (const e of this.entities.spatialHash.queryRange(
      Math.floor(box.left / CHUNK_SIZE_PX) - 1,
      Math.floor(box.top / CHUNK_SIZE_PX) - 1,
      Math.floor(box.right / CHUNK_SIZE_PX) + 1,
      Math.floor(box.bottom / CHUNK_SIZE_PX) + 1,
    )) {
      if (
        e === s.entity ||
        !e.collider ||
        e.collider.solid === false ||
        e.flashHidden ||
        roofSupport(e, [s.entity]) ||
        bedInteriorOccupant(s.entity, e)
      )
        continue;
      // A roof passenger's feet are at the roof plane, outside the vehicle body.
      if ((e.wz ?? 0) >= height - 0.05) continue;
      const obstacle = getEntityAABB(e.position, e.collider);
      if (
        aabbsOverlap(box, obstacle) &&
        !(recovering && separatesContact(this.box(s, 0), box, obstacle))
      )
        return isVehicle(e) ? "traffic" : "crossing";
    }
    return "";
  }
  /** Returns a blocking reason, or an empty string after securing the junction. */
  private reserve(s: TrafficState, reuseRoad = false): string {
    if (s.turn || s.reservation === s.lane.to) return "";
    if (!s.next) return "route end";
    const owner = this.reservations.get(s.lane.to);
    if (owner !== undefined && owner !== s.entity.id) return "junction";
    // Check actual directional footprints through a whole vehicle length of exit.
    // A padded corridor box also covers the opposite lane and can deadlock all
    // approaches even when every selected exit is physically clear.
    const exitAhead = s.lane.path.length - s.distance + turnPath(s.lane, s.next).length;
    const exitCollider = vehicleBodySize(s.entity.type, vehicleCardinalHeading(s.next.direction));
    const exitLength = Math.max(
      72,
      s.entity.collider?.width ?? 0,
      s.entity.collider?.height ?? 0,
      exitCollider.width,
      exitCollider.height,
    );
    for (let d = 0; d < exitLength + 8; d += 8) {
      const reason = this.blocked(s, exitAhead + Math.min(d, exitLength), reuseRoad);
      if (reason) return reason;
    }
    this.reservations.set(s.lane.to, s.entity.id);
    s.reservation = s.lane.to;
    return "";
  }
  /** Called once per physics tick after player input. No wander AI, damage or pushing. */
  get shoppingDiagnostics() {
    const states = [...this.states.values()];
    const trips = states.flatMap((s) => (s.shopping ? [s.shopping.diagnostics] : []));
    return {
      maneuvers: trips.reduce((n, t) => n + t.maneuvers, 0),
      completed: states.reduce((n, s) => n + (s.shoppingTrips ?? 0), 0),
      visits: trips.flatMap((t) => t.visits),
    };
  }
  private nearbyCenters() {
    const centers = new Map<string, ShoppingCenter>();
    for (const r of this.visibleRanges)
      for (const c of this.strategy.shoppingCenters?.(
        (r.minCx + r.maxCx + 1) * 128,
        (r.minCy + r.maxCy + 1) * 128,
      ) ?? [])
        if (this.visible(c.wx + 640, c.wy + 480, 720)) centers.set(c.id, c);
    return [...centers.values()];
  }
  /** Bounded terrain dependencies exist only while a center is near a live view. */
  shoppingRanges(): ChunkRange[] {
    return this.nearbyCenters().map((c) => ({
      minCx: Math.floor(c.wx / 256),
      maxCx: Math.floor((c.wx + 1279) / 256),
      minCy: Math.floor(c.wy / 256),
      maxCy: Math.floor((c.roadY + 63) / 256),
    }));
  }
  private centerReady(c: ShoppingCenter) {
    const b = shoppingLot(c, "compact-1").bounds;
    for (let y = Math.floor(b.top / 256); y <= Math.floor((b.bottom - 1) / 256); y++)
      for (let x = Math.floor(b.left / 256); x <= Math.floor((b.right - 1) / 256); x++)
        if (!this.world.getChunkIfLoaded(x, y)) return false;
    return true;
  }
  private tryShopping(s: TrafficState) {
    if (
      s.shoppingCooldown ||
      s.turn ||
      s.resumePath ||
      s.lane.direction !== Direction.Left ||
      !/^vehicle-v1:compact-[1-6]$/.test(s.entity.type)
    )
      return false;
    for (const c of this.strategy.shoppingCenters?.(s.entity.position.wx, s.entity.position.wy) ??
      []) {
      if (
        Math.abs(s.entity.position.wx - c.wx - 1176) > 0.8 ||
        Math.abs(s.entity.position.wy - c.roadY + 32) > 0.8 ||
        !this.centerReady(c) ||
        !this.visible(c.wx + 640, c.wy + 480, 720)
      )
        continue;
      if ([...this.states.values()].some((t) => t.shopping?.lot.id === c.id)) continue;
      // Capture the actual road body; no entrance spawn or position replacement.
      this.takeControl(s, -1);
      delete s.driverId;
      const shopping = new ParkingSystem(
        shoppingLot(c, s.entity.type.slice(11)),
        this.world,
        this.entities,
        this.props,
        () => this.onChange?.(s, false),
        undefined,
        true,
      );
      shopping.bindCar(s.entity);
      s.shopping = shopping;
      this.onChange?.(s, false);
      return true;
    }
    return false;
  }
  /** Shares the lab trip owner before generic pedestrian integration. */
  syncShopping() {
    for (const s of this.states.values()) s.shopping?.sync();
  }
  tickShopping(dt: number, excluded?: ReadonlySet<number>) {
    this.liveShopping.clear();
    for (const s of this.states.values()) {
      const trip = s.shopping;
      if (
        !trip ||
        !this.visible(
          (trip.lot.bounds.left + trip.lot.bounds.right) / 2,
          (trip.lot.bounds.top + trip.lot.bounds.bottom) / 2,
          720,
        )
      )
        continue;
      this.liveShopping.add(trip);
      trip.tick(dt, excluded);
      if (trip.states[0]?.phase === "waiting") {
        trip.dispose();
        delete s.shopping;
        s.shoppingCooldown = 120;
        s.shoppingTrips = (s.shoppingTrips ?? 0) + 1;
        this.releaseControl(s, true);
      }
    }
  }
  admitShoppingShoppers(dts: Map<Entity, number>, dt: number) {
    for (const s of this.states.values()) {
      if (!s.shopping) continue;
      for (const state of s.shopping.states) if (state.shopper) dts.delete(state.shopper);
      if (this.liveShopping.has(s.shopping)) s.shopping.admitShoppers(dts, dt);
    }
  }
  private populateShopping() {
    for (const c of this.nearbyCenters()) {
      if (!this.centerReady(c)) continue;
      for (const [i, p] of SHOPPING_PARKED_BAYS.entries()) {
        if (this.states.size >= 1024) return;
        const wx = c.wx + p[0],
          wy = c.wy + p[1];
        const identity = `placed-vehicle-v1:${c.id}:bay:${i}`;
        if (
          !this.visible(wx, wy) ||
          !this.canSpawn(identity, wx, wy) ||
          [...this.states.values()].some((s) => s.entity.proceduralId === identity)
        )
          continue;
        const probe = createVehicle(
          `compact-${1 + (i % 6)}`,
          wx,
          wy,
          i % 2 ? Direction.Down : Direction.Up,
        );
        probe.id = -1;
        if (
          !drivenCarPose(
            probe,
            { dx: 0, dy: 0 },
            1 / 60,
            this.world,
            this.props.props,
            this.entities.entities,
            this.drivingQueries,
          )
        )
          continue;
        const s = this.add(`compact-${1 + (i % 6)}`, placementLane(identity, wx, wy), 0, false, {
          x: wx,
          y: wy,
          direction: i % 2 ? Direction.Down : Direction.Up,
        });
        s.entity.proceduralId = identity;
        s.placed = s.parked = true;
        this.onChange?.(s, false);
      }
    }
  }
  tick(
    dt: number,
    players: readonly Entity[],
    active?: ReadonlySet<Entity>,
    excludedRiderIds?: ReadonlySet<number>,
  ) {
    this.time += dt;
    this.spawnClock -= dt;
    if (this.spawnClock <= 0) {
      this.populateBoats();
      this.populateRacers(players);
      this.populateShopping();
      this.populate(players);
      this.spawnClock = 2;
    }
    for (const s of this.states.values()) {
      if (!this.entities.entities.includes(s.entity)) {
        this.remove(s);
        continue;
      }
      if (active && !active.has(s.entity)) continue;
      s.shoppingCooldown = Math.max(0, (s.shoppingCooldown ?? 0) - dt);
      if (s.driverId !== undefined || s.parked) continue;
      if (this.tryShopping(s)) continue;
      this.choose(s);
      const end = (s.turn ?? s.lane.path).length;
      const half = Math.max(s.entity.collider?.width ?? 0, s.entity.collider?.height ?? 0) / 2;
      const lookahead = Math.max(24, (s.speed * s.speed) / (2 * TRAFFIC_BRAKE) + 12);
      let clearance = lookahead,
        reason = "";
      // No edits/callbacks or car movement occur within this synchronous sweep.
      // Later cars, movement/support checks and rerouting always start fresh.
      this.roadProbeClear.fill(0);
      for (let d = 0; d <= lookahead; d += 4) {
        const r = this.blocked(s, d, true);
        if (r) {
          clearance = Math.max(0, d - this.settings.gap);
          reason = r;
          break;
        }
      }
      // Queued approaches must leave the configured gap outside turning bodies,
      // including the sideways footprint change halfway through a left turn.
      const stopMargin = s.next ? Math.max(half + 8, half * 2) + this.settings.gap : half + 8;
      if (!s.turn && end - s.distance < lookahead + stopMargin) {
        const junctionReason = this.reserve(s, true);
        if (junctionReason) {
          clearance = Math.min(clearance, Math.max(0, end - s.distance - stopMargin));
          // Preserve exit failures so a lost road/prop obstruction can reroute.
          reason ||= junctionReason;
        }
      }
      if (!s.next) {
        clearance = Math.min(clearance, Math.max(0, end - s.distance - half));
        reason = "route end";
      }
      const target = Math.min(
        s.lane.race?.speed ?? (s.turn ? Math.min(24, this.settings.speed) : this.settings.speed),
        Math.sqrt(2 * TRAFFIC_BRAKE * clearance),
      );
      s.speed =
        target > s.speed
          ? Math.min(target, s.speed + TRAFFIC_ACCELERATION * dt)
          : Math.max(target, s.speed - TRAFFIC_BRAKE * dt);
      // Hard safety bound for sudden edits/obstacles, even inside braking distance.
      let move = Math.min(s.speed * dt, clearance);
      const surface = s.lane.surfaceFollowing ? this.surfaceProbe(s, move) : undefined;
      if (surface?.reason) {
        move = 0;
        reason = surface.reason;
      }
      if (move < 0.001) s.speed = 0;
      const owner = this.reservations.get(s.lane.to);
      const overshoot = s.distance - (end - stopMargin);
      if (
        move === 0 &&
        !s.turn &&
        !s.lane.surfaceFollowing &&
        owner !== s.entity.id &&
        (owner !== undefined || reason === "traffic") &&
        overshoot > 0.001
      ) {
        // Old saved queues can already occupy the turning safety gap. Ease back
        // along the same lane only when both body probes and passenger plans fit.
        const retreat = Math.min(s.distance, overshoot, 8 * dt, 4);
        if (!this.blocked(s, -retreat, false, true)) {
          move = -retreat;
          reason = "yielding junction";
        }
      }
      const before = { ...s.entity.position };
      s.entity.prevPosition = before;
      s.entity.prevWz = s.entity.wz ?? 0;
      let pose = this.pose(s, move);
      const next: Entity = {
        ...s.entity,
        position: { wx: pose.x, wy: pose.y },
        sprite: s.entity.sprite ? { ...s.entity.sprite } : null,
      };
      if (surface && !surface.reason) next.wz = next.groundZ = surface.z;
      if (hasVehicleBed(next))
        next.vehicleHeading =
          move > 0.000001
            ? this.bedPathHeading(s, move)
            : (s.entity.vehicleHeading ?? vehicleCardinalHeading(s.entity.sprite?.direction));
      else delete next.vehicleHeading;
      applyVehicleFacing(next, pose.direction);
      const passengers = planMovingPassengers(
        s.entity,
        next,
        this.entities,
        this.props,
        this.world,
        excludedRiderIds,
      );
      if (!passengers) {
        move = s.speed = 0;
        reason = "passenger clearance";
        pose = this.pose(s, 0);
        s.entity.velocity = { vx: 0, vy: 0 };
      } else {
        carryMovingPassengers(passengers, this.entities);
        if (hasVehicleBed(next) && next.vehicleHeading !== undefined)
          s.entity.vehicleHeading = next.vehicleHeading;
        else if (Math.abs(move) > 0.000001) delete s.entity.vehicleHeading;
        s.entity.position = next.position;
        s.entity.collider = next.collider;
        s.entity.sprite = next.sprite;
        if (next.sortOffsetY !== undefined) s.entity.sortOffsetY = next.sortOffsetY;
        if (next.wz !== undefined) s.entity.wz = s.entity.groundZ = next.wz;
        s.entity.velocity = { vx: (pose.x - before.wx) / dt, vy: (pose.y - before.wy) / dt };
      }
      if (s.entity.sprite) s.entity.sprite.moving = Math.abs(move) > 0;
      s.waiting = reason;
      s.blockedSeconds = Math.abs(move) < 0.001 ? s.blockedSeconds + dt : 0;
      if (
        s.blockedSeconds > 3 &&
        !s.turn &&
        end - s.distance < half + 100 &&
        (reason === "road unavailable" || reason === "obstacle")
      ) {
        const previous = s.next;
        for (const next of nextLanes(this.network(s), s.lane, vehicleRoadWidth(s.entity.type))) {
          if (next.id === previous?.id) continue;
          s.next = next;
          const curve = turnPath(s.lane, next),
            start = end - s.distance;
          let clear = true;
          for (let d = 0; d < curve.length + half + 24; d += 8)
            if (this.blocked(s, start + d)) {
              clear = false;
              break;
            }
          if (clear) break;
          s.next = previous;
        }
        s.blockedSeconds = 0;
      }
      s.distance += move;
      if (s.distance >= end && s.next) {
        s.distance -= end;
        const connector = s.turn ?? turnPath(s.lane, s.next);
        // Tangent circuit segments share an endpoint: finish their zero-length
        // connector now, so every published/saved distance belongs to its path.
        if (s.turn || connector.length < 0.001) {
          s.lane = s.next;
          delete s.resumePath;
          s.next = undefined;
          s.turn = undefined;
          s.choices++;
        } else s.turn = connector;
      }
      for (const [node, owner] of this.reservations) {
        if (owner !== s.entity.id) continue;
        const [x = 0, y = 0] = node.split(",").map(Number);
        if (Math.max(Math.abs(pose.x - x * 16), Math.abs(pose.y - y * 16)) > 96 + half) {
          this.reservations.delete(node);
          if (s.reservation === node) s.reservation = undefined;
        }
      }
      this.entities.spatialHash.update(s.entity);
      this.onChange?.(s, false);
    }
  }
  takeControl(s: TrafficState, playerId: number): void {
    s.shopping?.dispose();
    delete s.shopping;
    s.shoppingCooldown = 120;
    s.driverId = playerId;
    s.parked = true;
    s.speed = 0;
    s.entity.velocity = { vx: 0, vy: 0 };
    for (const [node, owner] of this.reservations)
      if (owner === s.entity.id) this.reservations.delete(node);
    s.turn = undefined;
    s.next = undefined;
    s.reservation = undefined;
    s.distance = Math.min(s.distance, s.lane.path.length);
    this.onChange?.(s, false);
  }
  drive(
    s: TrafficState,
    input: {
      dx: number;
      dy: number;
      sprinting?: boolean;
      reversing?: boolean;
      relativeDriving?: boolean;
    },
    dt: number,
  ): void {
    s.entity.prevPosition = { ...s.entity.position };
    s.entity.prevWz = s.entity.wz ?? 0;
    const steps = Math.max(1, Math.ceil(dt * 60));
    for (let i = 0; i < steps; i++) {
      const pushes: VehiclePush[] = [];
      const next = drivenCarPose(
        s.entity,
        input,
        dt / steps,
        this.world,
        this.props.props,
        this.entities.entities,
        this.drivingQueries,
        pushes,
      );
      const plan =
        next && planMovingPassengers(s.entity, next, this.entities, this.props, this.world);
      if (!next || !plan) {
        s.entity.velocity = { vx: 0, vy: 0 };
        if (s.entity.sprite) s.entity.sprite.moving = false;
        break;
      }
      commitVehiclePushes(pushes, this.entities);
      carryMovingPassengers(plan, this.entities);
      Object.assign(s.entity, {
        position: next.position,
        velocity: next.velocity,
        collider: next.collider,
        sprite: next.sprite,
        wz: next.wz,
        groundZ: next.groundZ,
        sortOffsetY: next.sortOffsetY,
        vehicleHeading: next.vehicleHeading,
      });
    }
    this.entities.spatialHash.update(s.entity);
    this.onChange?.(s, false);
  }
  /** Return from the actual parked pose using a short checked road connector, never teleport. */
  releaseControl(s: TrafficState, resume = true): void {
    delete s.driverId;
    s.entity.velocity = { vx: 0, vy: 0 };
    if (s.entity.sprite) s.entity.sprite.moving = false;
    s.speed = 0;
    s.parked = true;
    if (
      resume &&
      !s.placed &&
      this.roadClear(getEntityAABB(s.entity.position, required(s.entity.collider)), true)
    ) {
      const graph = this.network(s);
      const choices = [...graph.lanes.values()]
        .flatMap((lane) => {
          if (
            // A player parks on the circuit; ordinary road-merge connectors
            // must never cut across its curved racing lanes or grassy infield.
            lane.race ||
            lane.width < vehicleRoadWidth(s.entity.type) ||
            !nextLanes(graph, lane, vehicleRoadWidth(s.entity.type)).length
          )
            return [];
          const a = required(lane.path.points[0]),
            b = required(lane.path.points.at(-1));
          const dx = b.x - a.x,
            dy = b.y - a.y,
            length = Math.hypot(dx, dy);
          const distance = Math.max(
            0,
            Math.min(
              length - 1,
              ((s.entity.position.wx - a.x) * dx + (s.entity.position.wy - a.y) * dy) / length,
            ),
          );
          const p = samplePath(lane.path, distance);
          const gap = Math.hypot(p.x - s.entity.position.wx, p.y - s.entity.position.wy);
          return gap <= lane.width / 2 ? [{ lane, p, b, gap }] : [];
        })
        .sort((a, b) => a.gap - b.gap || a.lane.id.localeCompare(b.lane.id));
      for (const choice of choices) {
        const connector = path([
          { x: s.entity.position.wx, y: s.entity.position.wy },
          choice.p,
          choice.b,
        ]);
        if (connector.length < 1) continue;
        const oldLane = s.lane,
          oldDistance = s.distance;
        s.lane = { ...choice.lane, path: connector };
        s.distance = 0;
        let clear = true;
        for (let d = 0; d <= choice.gap; d += 2)
          if (!this.roadClear(this.box(s, d), true)) {
            clear = false;
            break;
          }
        if (clear) {
          s.resumePath = connector;
          s.parked = false;
          break;
        }
        s.lane = oldLane;
        s.distance = oldDistance;
      }
    }
    this.onChange?.(s, false);
  }
  private remove(s: TrafficState) {
    for (const [node, owner] of this.reservations)
      if (owner === s.entity.id) this.reservations.delete(node);
    this.retired.set(s.entity.proceduralId ?? "", this.time + 30);
    if (this.retired.size > 256) this.retired.delete(this.retired.keys().next().value ?? "");
    s.shopping?.dispose();
    this.states.delete(s.entity.id);
    this.entities.remove(s.entity.id, false);
  }
  snapshot(s: TrafficState): SavedTraffic {
    return {
      ...(s.entity.emergencyState !== undefined ? { emergencyState: s.entity.emergencyState } : {}),
      ...(s.placed ? { placed: true } : {}),
      ...(s.shopping
        ? { shopping: { centerId: s.shopping.lot.id, trip: s.shopping.snapshot() } }
        : {}),
      shoppingCooldown: s.shoppingCooldown ?? 0,
      shoppingTrips: s.shoppingTrips ?? 0,
      parked: s.parked ?? false,
      facing: s.entity.sprite?.direction ?? 0,
      ...(s.entity.vehicleHeading !== undefined ? { vehicleHeading: s.entity.vehicleHeading } : {}),
      ...(s.entity.paintSchemeId === undefined ? {} : { paintSchemeId: s.entity.paintSchemeId }),
      ...(s.entity.vehicleBed ? { vehicleBed: true as const } : {}),
      ...(s.resumePath ? { resumePath: s.resumePath } : {}),
      identity: required(s.entity.proceduralId),
      model: s.entity.type.slice(11),
      laneId: s.lane.id,
      nextId: s.next?.id ?? null,
      x: s.lane.a.x,
      y: s.lane.a.y,
      wz: s.entity.wz ?? 0,
      wx: s.entity.position.wx,
      wy: s.entity.position.wy,
      distance: s.distance,
      turning: !!s.turn,
      choices: s.choices,
      speed: s.speed,
      blockedSeconds: s.blockedSeconds,
      vx: s.entity.velocity?.vx ?? 0,
      vy: s.entity.velocity?.vy ?? 0,
    };
  }
  save(): SavedTraffic[] {
    return [...this.states.values()].map((s) => this.snapshot(s));
  }
  /** Resolve and validate the complete batch before changing live traffic. */
  prepareRestore(records: readonly SavedTraffic[]) {
    const identities = new Set([...this.states.values()].map((s) => s.entity.proceduralId));
    const reserved = new Set(this.reservations.keys());
    const centers = new Set(
      [...this.states.values()].flatMap((s) => (s.shopping ? [s.shopping.lot.id] : [])),
    );
    return records.flatMap((r) => {
      if (identities.has(r.identity)) return [];
      if (
        !DRIVABLE_MODELS.includes(r.model) ||
        ![
          r.wz ?? 0,
          r.wx ?? r.x,
          r.wy ?? r.y,
          r.x,
          r.y,
          r.distance,
          r.choices,
          r.speed ?? 0,
          r.blockedSeconds ?? 0,
          r.shoppingCooldown ?? 0,
          r.shoppingTrips ?? 0,
          r.vx ?? 0,
          r.vy ?? 0,
        ].every(Number.isFinite) ||
        Math.abs(r.x) > 2 ** 28 ||
        Math.abs(r.y) > 2 ** 28 ||
        typeof r.identity !== "string"
      )
        throw new Error("Invalid saved traffic record.");
      if (
        r.emergencyState !== undefined &&
        !validVehicleLightState({ type: `vehicle-v1:${r.model}` }, r.emergencyState)
      )
        throw new Error("Invalid saved emergency state.");
      if (r.placed !== undefined && typeof r.placed !== "boolean")
        throw new Error("Invalid placed vehicle state.");
      if (
        r.placed &&
        (!(
          r.identity.startsWith("placed-vehicle-v1:") ||
          (r.model === BOAT_MODEL && /^lake-boat:[-0-9]+:[-0-9]+:[-0-9]+$/.test(r.identity))
        ) ||
          r.laneId !== r.identity ||
          !r.parked ||
          r.nextId !== null ||
          r.turning ||
          r.distance !== 0 ||
          r.resumePath)
      )
        throw new Error("Invalid placed vehicle route.");
      // Resolve the same local graph used when choosing the saved successor.
      const graph = r.placed
        ? EMPTY_TRAFFIC_ROUTES.trafficNetwork(0, 0)
        : this.strategy.trafficNetwork(r.wx ?? r.x, r.wy ?? r.y);
      const original = r.placed
        ? placementLane(r.identity, r.x, r.y)
        : (graph.lanes.get(r.laneId) ?? this.strategy.trafficNetwork(r.x, r.y).lanes.get(r.laneId));
      if (r.parked !== undefined && typeof r.parked !== "boolean")
        throw new Error("Invalid parked state.");
      if (r.vehicleBed !== undefined && (r.vehicleBed !== true || r.model !== "dump-truck"))
        throw new Error("Invalid vehicle bed profile");
      if (!validVehiclePaint(r.model, r.paintSchemeId))
        throw new Error("Invalid saved vehicle paint.");
      if (
        r.vehicleHeading !== undefined &&
        (!Number.isFinite(r.vehicleHeading) || Math.abs(r.vehicleHeading) > Math.PI + 0.000001)
      )
        throw new Error("Invalid saved vehicle heading.");
      if (r.facing !== undefined && ![0, 1, 2, 3].includes(r.facing))
        throw new Error("Invalid saved facing.");
      if (
        r.resumePath &&
        (r.resumePath.points.length < 2 ||
          r.resumePath.points.length > 4 ||
          !r.resumePath.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)))
      )
        throw new Error("Invalid return path.");
      const lane =
        original && r.resumePath ? { ...original, path: path(r.resumePath.points) } : original;
      if (!lane) throw new Error("Saved traffic lane is unavailable.");
      const next = r.nextId
        ? nextLanes(graph, lane, vehicleRoadWidth(`vehicle-v1:${r.model}`)).find(
            (l) => l.id === r.nextId,
          )
        : undefined;
      if (r.nextId && !next) throw new Error("Saved traffic successor is unavailable.");
      if (r.turning && (!next || reserved.has(lane.to)))
        throw new Error("Saved traffic reservation conflicts.");
      const activePath = r.turning && next ? turnPath(lane, next) : lane.path;
      if (r.distance < 0 || r.distance > activePath.length || (r.speed ?? 0) < 0)
        throw new Error("Invalid saved traffic progress.");
      if (r.turning) reserved.add(lane.to);
      let shopping: ParkingSystem | undefined;
      if (r.shopping) {
        const center = this.strategy
          .shoppingCenters?.(r.wx ?? r.x, r.wy ?? r.y)
          .find((c) => c.id === r.shopping?.centerId);
        if (
          !center ||
          centers.has(center.id) ||
          r.placed ||
          !r.parked ||
          r.turning ||
          r.resumePath ||
          r.nextId
        )
          throw new Error("Invalid saved shopping center");
        shopping = new ParkingSystem(
          shoppingLot(center, r.model),
          this.world,
          this.entities,
          this.props,
          () => {},
          r.shopping.trip,
          true,
        );
        const car = shopping.states[0]?.car;
        if (
          shopping.states[0]?.phase === "waiting" ||
          !car ||
          car.position.wx !== r.wx ||
          car.position.wy !== r.wy ||
          car.proceduralId !== r.identity
        )
          throw new Error("Invalid saved shopping car");
        centers.add(center.id);
      }
      identities.add(r.identity);
      return [{ r, lane, next, activePath, shopping }];
    });
  }
  restore(records: readonly SavedTraffic[]) {
    const prepared = this.prepareRestore(records);
    for (const { r, lane, next, activePath, shopping } of prepared) {
      const s = this.add(
        r.model,
        lane,
        r.distance,
        false,
        r.parked
          ? {
              x: r.wx ?? r.x,
              y: r.wy ?? r.y,
              direction: r.facing ?? samplePath(activePath, r.distance).direction,
            }
          : samplePath(activePath, r.distance),
        r.wz ?? 0,
      );
      if (r.emergencyState !== undefined) s.entity.emergencyState = r.emergencyState;
      s.placed = r.placed ?? false;
      s.parked = r.parked ?? false;
      if (r.resumePath) s.resumePath = r.resumePath;
      s.speed = r.parked ? 0 : (r.speed ?? 0);
      s.blockedSeconds = r.blockedSeconds ?? 0;
      s.entity.velocity = r.parked ? { vx: 0, vy: 0 } : { vx: r.vx ?? 0, vy: r.vy ?? 0 };
      s.next = next;
      s.choices = Math.max(0, Math.floor(r.choices));
      s.entity.proceduralId = r.identity;
      // Older dump records acquire the same qualified profile as new placements.
      if (r.model === "dump-truck") s.entity.vehicleBed = true;
      if (r.paintSchemeId === undefined) delete s.entity.paintSchemeId;
      else s.entity.paintSchemeId = r.paintSchemeId;
      s.distance = r.distance;
      if (r.turning) {
        s.turn = activePath;
        s.reservation = lane.to;
        this.reservations.set(lane.to, s.entity.id);
      }
      const pose = samplePath(activePath, r.distance);
      s.entity.position = r.parked
        ? { wx: r.wx ?? pose.x, wy: r.wy ?? pose.y }
        : { wx: pose.x, wy: pose.y };
      if ((r.parked || hasVehicleBed(s.entity)) && r.vehicleHeading !== undefined)
        s.entity.vehicleHeading = Math.fround(r.vehicleHeading);
      else if (!r.parked && hasVehicleBed(s.entity))
        s.entity.vehicleHeading = this.bedPathHeading(s, 0);
      applyVehicleFacing(s.entity, r.parked ? (r.facing ?? pose.direction) : pose.direction);
      this.entities.spatialHash.update(s.entity);
      s.shoppingCooldown = r.shoppingCooldown ?? 0;
      s.shoppingTrips = r.shoppingTrips ?? 0;
      if (shopping) {
        shopping.bindCar(s.entity, () => this.onChange?.(s, false));
        s.shopping = shopping;
      }
      this.onRestore?.(s, r);
    }
  }
  private populate(players: readonly Entity[]) {
    if (!players.length) return;
    for (const s of this.states.values())
      if (
        !this.managed &&
        !s.parked &&
        s.driverId === undefined &&
        !this.visible(s.entity.position.wx, s.entity.position.wy) &&
        players.every(
          (p) =>
            Math.hypot(p.position.wx - s.entity.position.wx, p.position.wy - s.entity.position.wy) >
            2200,
        )
      )
        this.remove(s);
    let automaticCount = 0;
    for (const state of this.states.values()) if (!state.placed) automaticCount++;
    if (this.states.size >= 1024 || automaticCount >= Math.min(32, players.length * 12)) return;
    for (const player of players) {
      const network = this.strategy.trafficNetwork(player.position.wx, player.position.wy);
      const spawnDistance = (lane: Lane) => {
        if (!lane.intercity) return Math.min(lane.path.length / 2, 320);
        const a = required(lane.path.points[0]),
          b = required(lane.path.points.at(-1));
        const dx = (b.x - a.x) / lane.path.length,
          dy = (b.y - a.y) / lane.path.length;
        return Math.max(
          80,
          Math.min(
            lane.path.length - 80,
            (player.position.wx - a.x) * dx + (player.position.wy - a.y) * dy - 700,
          ),
        );
      };
      const lanes = [...network.lanes.values()]
        .filter((l) => {
          if (l.race) return false;
          const p = samplePath(l.path, spawnDistance(l));
          return (
            l.path.length > 160 &&
            nextLanes(network, l, 80).length &&
            Math.hypot(p.x - player.position.wx, p.y - player.position.wy) < 1800
          );
        })
        .sort((a, b) => a.id.localeCompare(b.id));
      for (const lane of lanes) {
        if (this.states.size >= 1024 || automaticCount >= Math.min(32, players.length * 12)) break;
        if (lane.intercity && hash(`${lane.id}:${Math.floor(this.time / 30)}`) % 6 !== 0) continue;
        const sample = samplePath(lane.path, spawnDistance(lane));
        const dist = Math.hypot(sample.x - player.position.wx, sample.y - player.position.wy);
        if (dist < 420 || dist > 1800 || this.visible(sample.x, sample.y)) continue;
        const available = TRAFFIC_MODELS.filter((model) => {
          const width = vehicleRoadWidth(`vehicle-v1:${model}`);
          return (
            lane.width >= width &&
            nextLanes(network, lane, width).some(
              (next) => nextLanes(network, next, width).length > 0,
            )
          );
        });
        if (!available.length) continue;
        const model = required(available[hash(lane.id) % available.length]);
        const id = this.identity(model, lane, spawnDistance(lane));
        if (!this.canSpawn(id, sample.x, sample.y)) continue;
        if (
          (this.retired.get(id) ?? 0) > this.time ||
          [...this.states.values()].some((s) => s.entity.proceduralId === id)
        )
          continue;
        const s = this.add(model, lane, spawnDistance(lane), false);
        const paint = trafficPaint(model, id);
        if (paint !== undefined) s.entity.paintSchemeId = paint;
        applyVehicleFacing(s.entity);
        if (
          this.blocked(s, 0) ||
          this.entities.entities.some(
            (e) =>
              e !== s.entity &&
              Math.hypot(e.position.wx - sample.x, e.position.wy - sample.y) < 160,
          )
        ) {
          this.states.delete(s.entity.id);
          this.entities.remove(s.entity.id, false);
        } else {
          automaticCount++;
          this.onChange?.(s, false);
        }
      }
    }
  }
  /** Fixed, durable starting grid; moved/deleted racers never refill their old slot. */
  private populateRacers(players: readonly Entity[]) {
    const seen = new Set<string>();
    for (const player of players)
      for (const lane of this.strategy
        .trafficNetwork(player.position.wx, player.position.wy)
        .lanes.values()) {
        if (!lane.race || seen.has(lane.id)) continue;
        seen.add(lane.id);
        const distance = lane.path.length / 2,
          pose = samplePath(lane.path, distance);
        const id = this.identity(lane.race.model, lane, distance);
        if (
          this.states.size >= 1024 ||
          !this.visible(pose.x, pose.y) ||
          !this.canSpawn(id, pose.x, pose.y) ||
          [...this.states.values()].some((s) => s.entity.proceduralId === id)
        )
          continue;
        const state = this.add(lane.race.model, lane, distance, false);
        if (this.blocked(state, 0)) {
          this.entities.remove(state.entity.id, false);
        } else this.onChange?.(state, false);
      }
  }
  /** Keep a small halo around supported passengers regardless of free-camera position. */
  supportRanges(players: readonly Entity[]): ChunkRange[] {
    return players.flatMap((p) =>
      [...this.states.values()]
        .filter(
          (s) =>
            Math.hypot(s.entity.position.wx - p.position.wx, s.entity.position.wy - p.position.wy) <
            100,
        )
        .map((s) => {
          const cx = Math.floor(s.entity.position.wx / CHUNK_SIZE_PX),
            cy = Math.floor(s.entity.position.wy / CHUNK_SIZE_PX);
          return { minCx: cx - 3, minCy: cy - 3, maxCx: cx + 3, maxCy: cy + 3 };
        }),
    );
  }
}

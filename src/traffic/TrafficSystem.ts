import { required } from "../art/ArtCatalog.js";
import { CHUNK_SIZE_PX } from "../config/constants.js";
import {
  type AABB,
  aabbOverlapsPropWalls,
  aabbsOverlap,
  getEntityAABB,
} from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import type { PropManager } from "../entities/PropManager.js";
import { actorScope } from "../persistence/ActorRecords.js";
import { querySurfacePatch } from "../physics/SurfacePatch.js";
import { resolveGroundZForTracking } from "../physics/surfaceHeight.js";
import { bridgePart } from "../railway/RoadRailBridge.js";
import { RoadType } from "../road/RoadType.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import type { World } from "../world/World.js";
import {
  type Lane,
  type LaneGraph,
  nextLanes,
  type Path,
  samplePath,
  turnPath,
} from "./LaneGraph.js";
import { roofSupport } from "./RoofSupport.js";

export interface TrafficRouteSource {
  trafficNetwork(wx: number, wy: number): LaneGraph;
}

import {
  applyVehicleFacing,
  createVehicle,
  isVehicle,
  TRAFFIC_MODELS,
  vehicleRoadWidth,
  vehicleView,
} from "./Vehicle.js";

export interface SavedTraffic {
  persistentId?: string;
  originScope?: string;
  wz?: number;
  wx?: number;
  wy?: number;
  speed?: number;
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
  private spawnClock = 0;
  private retired = new Map<string, number>();
  private time = 0;
  constructor(
    readonly world: World,
    readonly entities: EntityManager,
    readonly props: PropManager,
    readonly strategy: TrafficRouteSource,
  ) {
    entities.removalListeners.add((entity, destroyed) => {
      const state = this.states.get(entity.id);
      if (!state) return;
      for (const [node, owner] of this.reservations)
        if (owner === entity.id) this.reservations.delete(node);
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
  ): TrafficState {
    const entity = createVehicle(model, pose.x, pose.y, pose.direction);
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
  private box(s: TrafficState, ahead: number): AABB {
    const pose = this.pose(s, ahead),
      view = required(vehicleView(s.entity.type, pose.direction)),
      c = required(view.metadata.colliders[0]);
    return {
      left: pose.x - c.width / 2,
      right: pose.x + c.width / 2,
      top: pose.y - c.height / 2,
      bottom: pose.y + c.height / 2,
    };
  }
  private roadClear(box: AABB, surfaceFollowing = false) {
    for (let y = Math.floor(box.top / 16); y <= Math.floor((box.bottom - 0.01) / 16); y++)
      for (let x = Math.floor(box.left / 16); x <= Math.floor((box.right - 0.01) / 16); x++) {
        const road = this.world.getRoadAt(x, y);
        if (
          !road ||
          road === 2 ||
          road === 6 ||
          (!surfaceFollowing &&
            (this.world.getHeightAt(x, y) !== 0 ||
              road === RoadType.RailHorizontalTop ||
              road === RoadType.RailHorizontalBottom))
        )
          return false;
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
          riders.includes(e)
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
  private blocked(s: TrafficState, ahead: number): string {
    if (s.lane.surfaceFollowing) return this.surfaceProbe(s, ahead).reason;
    const box = this.box(s, ahead),
      height = s.entity.collider?.physicalHeight ?? 24;
    if (!this.roadClear(box)) return "road unavailable";
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
      if (e === s.entity || !e.collider || e.collider.solid === false || e.flashHidden) continue;
      // A roof passenger's feet are at the roof plane, outside the vehicle body.
      if ((e.wz ?? 0) >= height - 0.05) continue;
      if (aabbsOverlap(box, getEntityAABB(e.position, e.collider)))
        return isVehicle(e) ? "traffic" : "crossing";
    }
    return "";
  }
  private reserve(s: TrafficState): boolean {
    if (s.turn || s.reservation === s.lane.to) return true;
    if (!s.next) return false;
    const owner = this.reservations.get(s.lane.to);
    if (owner !== undefined && owner !== s.entity.id) return false;
    // Require a clear road/prop/pedestrian exit as well as vehicle queue space.
    const exitAhead = s.lane.path.length - s.distance + turnPath(s.lane, s.next).length;
    for (let d = 0; d <= Math.max(72, s.entity.collider?.width ?? 0); d += 8)
      if (this.blocked(s, exitAhead + d)) return false;
    // Require room for the whole vehicle beyond the junction before entering.
    const exit = samplePath(s.next.path, Math.max(72, s.entity.collider?.width ?? 0));
    const box = {
      left: Math.min(required(s.next.path.points[0]).x, exit.x) - 28,
      right: Math.max(required(s.next.path.points[0]).x, exit.x) + 28,
      top: Math.min(required(s.next.path.points[0]).y, exit.y) - 28,
      bottom: Math.max(required(s.next.path.points[0]).y, exit.y) + 28,
    };
    for (const other of this.states.values())
      if (
        other !== s &&
        other.entity.collider &&
        aabbsOverlap(box, getEntityAABB(other.entity.position, other.entity.collider))
      )
        return false;
    this.reservations.set(s.lane.to, s.entity.id);
    s.reservation = s.lane.to;
    return true;
  }
  /** Called once per physics tick after player input. No wander AI, damage or pushing. */
  tick(dt: number, players: readonly Entity[], active?: ReadonlySet<Entity>) {
    this.time += dt;
    this.spawnClock -= dt;
    if (this.spawnClock <= 0) {
      this.populate(players);
      this.spawnClock = 2;
    }
    for (const s of this.states.values()) {
      if (!this.entities.entities.includes(s.entity)) {
        this.remove(s);
        continue;
      }
      if (active && !active.has(s.entity)) continue;
      this.choose(s);
      const end = (s.turn ?? s.lane.path).length;
      const half = Math.max(s.entity.collider?.width ?? 0, s.entity.collider?.height ?? 0) / 2;
      const lookahead = Math.max(24, (s.speed * s.speed) / (2 * TRAFFIC_BRAKE) + 12);
      let clearance = lookahead,
        reason = "";
      for (let d = 0; d <= lookahead; d += 4) {
        const r = this.blocked(s, d);
        if (r) {
          clearance = Math.max(0, d - this.settings.gap);
          reason = r;
          break;
        }
      }
      if (!s.turn && end - s.distance < lookahead + half + 8 && !this.reserve(s)) {
        clearance = Math.min(clearance, Math.max(0, end - s.distance - half - 8));
        reason = "junction";
      }
      if (!s.next) {
        clearance = Math.min(clearance, Math.max(0, end - s.distance - half));
        reason = "route end";
      }
      const target = Math.min(
        s.turn ? Math.min(24, this.settings.speed) : this.settings.speed,
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
      const before = { ...s.entity.position };
      s.entity.prevPosition = before;
      s.entity.prevWz = s.entity.wz ?? 0;
      if (surface && !surface.reason) {
        // Player movement has already applied horizontal platform carry this tick.
        // Preserve grounded passengers when this platform changes its roof plane.
        const dz = surface.z - (s.entity.wz ?? 0);
        for (const rider of this.entities.entities) {
          if (rider === s.entity || !roofSupport(rider, [s.entity])) continue;
          rider.wz = (rider.wz ?? 0) + dz;
          rider.groundZ = (rider.groundZ ?? rider.wz - dz) + dz;
        }
        s.entity.wz = s.entity.groundZ = surface.z;
      }
      const pose = this.pose(s, move);
      s.entity.position.wx = pose.x;
      s.entity.position.wy = pose.y;
      applyVehicleFacing(s.entity, pose.direction);
      s.entity.velocity = { vx: (pose.x - before.wx) / dt, vy: (pose.y - before.wy) / dt };
      if (s.entity.sprite) s.entity.sprite.moving = move > 0;
      s.waiting = reason;
      s.blockedSeconds = move < 0.001 ? s.blockedSeconds + dt : 0;
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
        if (s.turn) {
          s.lane = s.next;
          s.next = undefined;
          s.turn = undefined;
          s.choices++;
        } else s.turn = turnPath(s.lane, s.next);
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
  private remove(s: TrafficState) {
    for (const [node, owner] of this.reservations)
      if (owner === s.entity.id) this.reservations.delete(node);
    this.retired.set(s.entity.proceduralId ?? "", this.time + 30);
    if (this.retired.size > 256) this.retired.delete(this.retired.keys().next().value ?? "");
    this.states.delete(s.entity.id);
    this.entities.remove(s.entity.id, false);
  }
  snapshot(s: TrafficState): SavedTraffic {
    return {
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
    return records.flatMap((r) => {
      if (identities.has(r.identity)) return [];
      if (
        !TRAFFIC_MODELS.includes(r.model) ||
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
          r.vx ?? 0,
          r.vy ?? 0,
        ].every(Number.isFinite) ||
        Math.abs(r.x) > 2 ** 28 ||
        Math.abs(r.y) > 2 ** 28 ||
        typeof r.identity !== "string"
      )
        throw new Error("Invalid saved traffic record.");
      // Resolve the same local graph used when choosing the saved successor.
      const graph = this.strategy.trafficNetwork(r.wx ?? r.x, r.wy ?? r.y),
        lane = graph.lanes.get(r.laneId);
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
      identities.add(r.identity);
      return [{ r, lane, next, activePath }];
    });
  }
  restore(records: readonly SavedTraffic[]) {
    const prepared = this.prepareRestore(records);
    for (const { r, lane, next, activePath } of prepared) {
      const s = this.add(
        r.model,
        lane,
        r.distance,
        false,
        samplePath(activePath, r.distance),
        r.wz ?? 0,
      );
      s.speed = r.speed ?? 0;
      s.blockedSeconds = r.blockedSeconds ?? 0;
      s.entity.velocity = { vx: r.vx ?? 0, vy: r.vy ?? 0 };
      s.next = next;
      s.choices = Math.max(0, Math.floor(r.choices));
      s.entity.proceduralId = r.identity;
      s.distance = r.distance;
      if (r.turning) {
        s.turn = activePath;
        s.reservation = lane.to;
        this.reservations.set(lane.to, s.entity.id);
      }
      const pose = samplePath(activePath, r.distance);
      s.entity.position = { wx: pose.x, wy: pose.y };
      applyVehicleFacing(s.entity, pose.direction);
      this.entities.spatialHash.update(s.entity);
      this.onRestore?.(s, r);
    }
  }
  private populate(players: readonly Entity[]) {
    if (!players.length) return;
    for (const s of this.states.values())
      if (
        !this.managed &&
        !this.visible(s.entity.position.wx, s.entity.position.wy) &&
        players.every(
          (p) =>
            Math.hypot(p.position.wx - s.entity.position.wx, p.position.wy - s.entity.position.wy) >
            2200,
        )
      )
        this.remove(s);
    if (this.states.size >= Math.min(32, players.length * 12)) return;
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
          const p = samplePath(l.path, spawnDistance(l));
          return (
            l.path.length > 160 &&
            nextLanes(network, l, 80).length &&
            Math.hypot(p.x - player.position.wx, p.y - player.position.wy) < 1800
          );
        })
        .sort((a, b) => a.id.localeCompare(b.id));
      for (const lane of lanes) {
        if (this.states.size >= Math.min(32, players.length * 12)) break;
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
        } else this.onChange?.(s, false);
      }
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

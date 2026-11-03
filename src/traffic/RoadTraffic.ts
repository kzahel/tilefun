import { ELEVATION_PX } from "../config/constants.js";
import { getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import { zRangesOverlap } from "../physics/AABB3D.js";
import { physicsBodyDimensions } from "../physics/PhysicsBodies.js";
import type { MotionIntent } from "../physics/PhysicsState.js";
import { CONTROL_HOLD_TICKS } from "../physics/PlayerControls.js";
import { angleDifference } from "../physics/VehicleMotor.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import { type Lane, type LaneGraph, nextLanes, type Path, samplePath } from "./LaneGraph.js";
import { roadTurn } from "./RoadTurn.js";
import {
  isVehicleOverturned,
  TRAFFIC_MODELS,
  vehicleNoseHeading,
  vehicleRoadWidth,
  vehicleTurningRadius,
} from "./Vehicle.js";
import { vehiclePerformance } from "./VehiclePerformance.js";
import type { VehicleRegistry, VehicleState } from "./VehicleRegistry.js";

export interface TrafficRoute {
  laneId: string;
  choices: number;
  nextId?: string;
  turning?: boolean;
}
const hash = (text: string) => {
  let n = 2166136261;
  for (let i = 0; i < text.length; i++) n = Math.imul(n ^ text.charCodeAt(i), 16777619);
  return n >>> 0;
};
/** Project actual solved travel onto a route; route progress never moves a body. */
export function projectRoad(p: Path, x: number, y: number) {
  let distance = Infinity,
    progress = 0,
    heading = 0;
  for (let i = 1; i < p.points.length; i++) {
    const a = p.points[i - 1],
      b = p.points[i];
    if (!a || !b) continue;
    const dx = b.x - a.x,
      dy = b.y - a.y,
      length2 = dx * dx + dy * dy;
    const t = length2 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / length2)) : 0;
    const d = Math.hypot(x - a.x - t * dx, y - a.y - t * dy);
    if (d < distance) {
      distance = d;
      progress = (p.distances[i - 1] ?? 0) + t * Math.sqrt(length2);
      heading = Math.atan2(dy, dx);
    }
  }
  return { distance, progress, heading };
}

/** Bounded road decisions only. Cars share the same physical motor as players. */
export class RoadTraffic {
  private reservations = new Map<
    string,
    { id: number; x: number; y: number; clearance: number; issued: number; entered: boolean }
  >();
  private waiting = new Map<number, number>();
  private tick = 0;
  private turns = new Map<string, ReturnType<typeof roadTurn>>();
  private models = new Map<number, string[]>();
  constructor(private readonly registry: VehicleRegistry) {}

  private corner(lane: Lane, next: Lane, type: string) {
    const radius = vehicleTurningRadius(type),
      key = `${lane.id}:${next.id}:${radius}`;
    let cached = this.turns.get(key);
    if (!cached) {
      cached = roadTurn(lane, next, radius);
      this.turns.set(key, cached);
      if (this.turns.size > 256) this.turns.delete(this.turns.keys().next().value ?? "");
    }
    return cached;
  }

  populate(ranges: readonly ChunkRange[]) {
    const r = this.registry;
    if (!r.source.trafficNetwork) return;
    let population = [...r.states.values()].filter((s) => s.autonomous).length;
    if (population >= 32) return;
    const graphs = new Set<LaneGraph>();
    const identities = new Set([...r.states.values()].map((s) => s.entity.proceduralId));
    for (const range of ranges)
      for (let cy = range.minCy; cy <= range.maxCy; cy++)
        for (let cx = range.minCx; cx <= range.maxCx; cx++) {
          if (!r.world.getChunkIfLoaded(cx, cy)) continue;
          const graph = r.source.trafficNetwork(cx * 256 + 128, cy * 256 + 128);
          if (graphs.has(graph)) continue;
          graphs.add(graph);
          for (const lane of graph.lanes.values()) {
            if (lane.race) continue;
            if (
              !ranges.some(
                (a) =>
                  Math.max(lane.a.x, lane.b.x) + lane.width >= a.minCx * 256 &&
                  Math.min(lane.a.x, lane.b.x) - lane.width < (a.maxCx + 1) * 256 &&
                  Math.max(lane.a.y, lane.b.y) + lane.width >= a.minCy * 256 &&
                  Math.min(lane.a.y, lane.b.y) - lane.width < (a.maxCy + 1) * 256,
              )
            )
              continue;
            let models = this.models.get(lane.width);
            if (!models) {
              models = TRAFFIC_MODELS.filter(
                (model) =>
                  vehicleRoadWidth(`vehicle-v1:${model}`) <= lane.width &&
                  vehicleTurningRadius(`vehicle-v1:${model}`) <= lane.width / 2,
              );
              this.models.set(lane.width, models);
            }
            if (!models.length) continue;
            for (let slot = 0; slot * 256 + 128 < lane.path.length - 64; slot++) {
              const p = samplePath(lane.path, slot * 256 + 128);
              if (!r.world.getRoadAt(Math.floor(p.x / 16), Math.floor(p.y / 16))) continue;
              if (
                !ranges.some(
                  (a) =>
                    p.x >= a.minCx * 256 &&
                    p.x < (a.maxCx + 1) * 256 &&
                    p.y >= a.minCy * 256 &&
                    p.y < (a.maxCy + 1) * 256,
                )
              )
                continue;
              const identity = `traffic-v1:${lane.id}:slot-${slot}`;
              if (hash(identity) % 3 !== 0) continue;
              if (!r.canSpawn(identity, p.x, p.y) || identities.has(identity)) continue;
              const model = models[hash(identity) % models.length];
              if (!model) continue;
              const ground = lane.surfaceFollowing
                ? undefined
                : r.world.getHeightAt(Math.floor(p.x / 16), Math.floor(p.y / 16)) * ELEVATION_PX;
              const state = r.place(model, p.x, p.y, p.direction, undefined, identity, ground);
              if (!state) continue;
              state.autonomous = true;
              identities.add(identity);
              state.route = { laneId: lane.id, choices: 0 };
              r.onChange?.(state, false);
              if (++population >= 32) return;
            }
          }
        }
  }

  private acquire(state: VehicleState, graph: LaneGraph): Lane | undefined {
    const e = state.entity;
    if (
      !this.registry.world.getRoadAt(Math.floor(e.position.wx / 16), Math.floor(e.position.wy / 16))
    )
      return undefined;
    let best: Lane | undefined,
      score = Infinity;
    for (const lane of graph.lanes.values()) {
      if (
        lane.race ||
        lane.width < Math.max(vehicleRoadWidth(e.type), vehicleTurningRadius(e.type) * 2)
      )
        continue;
      const projection = projectRoad(lane.path, e.position.wx, e.position.wy);
      if (projection.distance > Math.max(24, lane.width / 2)) continue;
      const error = Math.abs(angleDifference(projection.heading, vehicleNoseHeading(e)));
      if (error > Math.PI / 2) continue;
      const value = projection.distance + error * 24;
      if (value < score) {
        score = value;
        best = lane;
      }
    }
    if (best) {
      state.route = { laneId: best.id, choices: state.route?.choices ?? 0 };
      const clearance = best.width / 2 + physicsBodyDimensions(e).width / 2 + 12;
      if (
        Math.hypot(e.position.wx - best.a.x, e.position.wy - best.a.y) < clearance &&
        !this.reservations.has(best.from)
      )
        this.reservations.set(best.from, {
          id: e.id,
          x: best.a.x,
          y: best.a.y,
          clearance,
          issued: this.tick,
          entered: true,
        });
    }
    return best;
  }

  plan(active: readonly Entity[], physicsTick: number): Map<number, MotionIntent> {
    const r = this.registry,
      intents = new Map<number, MotionIntent>();
    if (!r.source.trafficNetwork) return intents;
    this.tick = physicsTick;
    for (const [key, held] of this.reservations) {
      const owner = r.states.get(held.id),
        car = owner?.entity;
      const distance = car
        ? Math.hypot(car.position.wx - held.x, car.position.wy - held.y)
        : Infinity;
      if (distance <= held.clearance) held.entered = true;
      if (
        !car ||
        (held.entered && distance > held.clearance) ||
        (!held.entered && (owner?.driverId !== undefined || this.tick - held.issued > 180))
      ) {
        this.reservations.delete(key);
        this.waiting.set(held.id, this.tick);
      }
    }
    for (const id of this.waiting.keys())
      if (!r.states.has(id) || r.states.get(id)?.driverId !== undefined) this.waiting.delete(id);
    const candidates: {
      state: VehicleState;
      lane: Lane;
      next: Lane | undefined;
      path: Path;
      progress: number;
      remaining: number;
      halfLength: number;
      halfWidth: number;
    }[] = [];
    for (const e of active) {
      const state = r.states.get(e.id);
      if (!state?.autonomous || state.driverId !== undefined) continue;
      if (isVehicleOverturned(e)) {
        intents.set(e.id, { vx: 0, vy: 0, driveSpeed: 0 });
        continue;
      }
      const graph = r.source.trafficNetwork(e.position.wx, e.position.wy);
      const lane =
        (state.route && graph.lanes.get(state.route.laneId)) || this.acquire(state, graph);
      if (!lane || !state.route) {
        state.autonomous = false;
        delete state.route;
        r.onChange?.(state, false);
        continue;
      }
      let next = state.route.nextId ? graph.lanes.get(state.route.nextId) : undefined;
      if (!next) {
        const choices = nextLanes(
          graph,
          lane,
          Math.max(vehicleRoadWidth(e.type), vehicleTurningRadius(e.type) * 2),
        ).filter((l) => !l.race);
        next = choices[hash(`${e.proceduralId}:${state.route.choices}`) % choices.length];
        if (next) {
          state.route.nextId = next.id;
          r.onChange?.(state, false);
        }
      }
      const corner = next ? this.corner(lane, next, e.type) : undefined;
      const p = corner ? (state.route.turning ? corner.turn : corner.approach) : lane.path;
      const projection = projectRoad(p, e.position.wx, e.position.wy);
      const size = physicsBodyDimensions(e);
      candidates.push({
        state,
        lane,
        next,
        path: p,
        progress: projection.progress,
        remaining: p.length - projection.progress,
        halfLength: size.width / 2,
        halfWidth: size.depth / 2,
      });
    }
    for (const c of candidates)
      if (c.state.route?.turning && !this.reservations.has(c.lane.to))
        this.reservations.set(c.lane.to, {
          id: c.state.entity.id,
          x: c.lane.b.x,
          y: c.lane.b.y,
          clearance: c.lane.width / 2 + c.halfLength + 12,
          issued: this.tick,
          entered: true,
        });
    for (const c of candidates)
      if (
        !c.state.route?.turning &&
        c.remaining < c.halfLength + 64 &&
        !this.waiting.has(c.state.entity.id)
      )
        this.waiting.set(c.state.entity.id, this.tick);
    candidates.sort(
      (a, b) =>
        (this.waiting.get(a.state.entity.id) ?? Infinity) -
          (this.waiting.get(b.state.entity.id) ?? Infinity) ||
        a.remaining - b.remaining ||
        (a.state.entity.proceduralId ?? "").localeCompare(b.state.entity.proceduralId ?? ""),
    );
    for (const c of candidates) {
      const e = c.state.entity;
      const occupied = candidates.some(
        (other) =>
          other.state.entity.id !== e.id &&
          other.state.route?.turning &&
          other.lane.to === c.lane.to,
      );
      if (
        !occupied &&
        !this.reservations.has(c.lane.to) &&
        this.waiting.has(e.id) &&
        c.next &&
        this.exitClear(c.next, e, c.halfLength, c.halfWidth)
      )
        this.reservations.set(c.lane.to, {
          id: e.id,
          x: c.lane.b.x,
          y: c.lane.b.y,
          clearance: c.lane.width / 2 + c.halfLength + 12,
          issued: this.tick,
          entered: false,
        });
      const owns = this.reservations.get(c.lane.to)?.id === e.id;
      const rolling = Math.hypot(e.velocity?.vx ?? 0, e.velocity?.vy ?? 0);
      const lookahead = Math.max(24, Math.min(64, 24 + rolling * 0.3));
      let aim = samplePath(c.path, c.progress + lookahead);
      if (c.progress + lookahead > c.path.length && c.next)
        aim = samplePath(
          c.state.route?.turning ? c.next.path : this.corner(c.lane, c.next, e.type).turn,
          c.progress + lookahead - c.path.length,
        );
      const error = angleDifference(
        Math.atan2(aim.y - e.position.wy, aim.x - e.position.wx),
        vehicleNoseHeading(e),
      );
      let speed = Math.min(64, vehiclePerformance(e.type).speed * 0.65);
      if (c.state.route?.turning || c.remaining < 100) speed = Math.min(speed, 36);
      if (!owns && !c.state.route?.turning)
        speed = Math.min(
          speed,
          Math.sqrt(
            2 *
              vehiclePerformance(e.type).acceleration *
              Math.max(0, c.remaining - c.halfLength - 12),
          ),
        );
      if (!c.next && c.remaining < c.halfLength + 12) speed = 0;
      speed = this.followingSpeed(e, speed, c.halfLength, c.halfWidth);
      const tx = Math.floor(aim.x / 16),
        ty = Math.floor(aim.y / 16);
      if (
        !r.world.getChunkIfLoaded(Math.floor(tx / 16), Math.floor(ty / 16)) ||
        r.world.getCollisionIfLoaded(tx, ty) & CollisionFlag.Solid
      )
        speed = 0;
      if (
        c.lane.requiredSurfaces?.some((surface) => {
          const b = surface.bounds;
          if (
            e.position.wx < b.left - 96 ||
            e.position.wx > b.right + 96 ||
            e.position.wy < b.top - 96 ||
            e.position.wy > b.bottom + 96
          )
            return false;
          return !r.props
            .getPropsInChunkRange(
              Math.floor(b.left / 256),
              Math.floor(b.top / 256),
              Math.floor(b.right / 256),
              Math.floor(b.bottom / 256),
            )
            .some((p) =>
              (p.walls ?? (p.collider ? [p.collider] : [])).some(
                (c) => c.surface?.id === surface.id,
              ),
            );
        })
      )
        speed = 0;
      intents.set(e.id, {
        vx: 0,
        vy: 0,
        controlUntil: physicsTick + CONTROL_HOLD_TICKS,
        driveSpeed: speed,
        steering: Math.max(
          -1,
          Math.min(1, (2 * vehicleTurningRadius(e.type) * Math.sin(error)) / lookahead),
        ),
      });
      if (c.remaining <= 6 && c.next && c.state.route) {
        if (c.state.route.turning) {
          c.state.route = { laneId: c.next.id, choices: c.state.route.choices + 1 };
          this.waiting.delete(e.id);
        } else if (owns) c.state.route.turning = true;
        r.onChange?.(c.state, false);
      }
    }
    return intents;
  }

  private exitClear(lane: Lane, e: Entity, length: number, width: number) {
    const p = samplePath(lane.path, 0),
      q = samplePath(lane.path, 1);
    const heading = Math.atan2(q.y - p.y, q.x - p.x);
    return !this.registry.entities.spatialHash
      .queryRadius(p.x, p.y, length * 2 + 48)
      .some((other) => {
        if (
          other.id === e.id ||
          !other.collider ||
          other.collider.solid === false ||
          other.parentId !== undefined ||
          !zRangesOverlap(
            e.wz ?? 0,
            e.collider?.physicalHeight ?? 24,
            other.wz ?? 0,
            other.collider.physicalHeight ?? 12,
          )
        )
          return false;
        const dx = other.position.wx - p.x,
          dy = other.position.wy - p.y;
        return (
          dx * Math.cos(heading) + dy * Math.sin(heading) > -length &&
          Math.abs(-dx * Math.sin(heading) + dy * Math.cos(heading)) <
            width + Math.min(other.collider.width, other.collider.height) / 2 + 4
        );
      });
  }

  private followingSpeed(e: Entity, speed: number, length: number, width: number) {
    const heading = vehicleNoseHeading(e),
      c = Math.cos(heading),
      s = Math.sin(heading);
    for (const other of this.registry.entities.spatialHash.queryRadius(
      e.position.wx,
      e.position.wy,
      160,
    )) {
      if (
        other.id === e.id ||
        !other.collider ||
        other.collider.solid === false ||
        other.parentId !== undefined ||
        !zRangesOverlap(
          e.wz ?? 0,
          e.collider?.physicalHeight ?? 24,
          other.wz ?? 0,
          other.collider.physicalHeight ?? 12,
        )
      )
        continue;
      const ownRoute = this.registry.states.get(e.id)?.route;
      const otherState = this.registry.states.get(other.id);
      if (
        ownRoute &&
        otherState?.autonomous &&
        otherState.driverId === undefined &&
        otherState.route
      ) {
        const otherLane = otherState.route.laneId;
        if (otherLane !== ownRoute.laneId && !(ownRoute.turning && otherLane === ownRoute.nextId))
          continue;
      }
      const b = getEntityAABB(other.position, other.collider),
        dx = (b.left + b.right) / 2 - e.position.wx,
        dy = (b.top + b.bottom) / 2 - e.position.wy;
      const ahead = dx * c + dy * s,
        side = Math.abs(-dx * s + dy * c);
      let alongHalf =
        (Math.abs(c) * (b.right - b.left)) / 2 + (Math.abs(s) * (b.bottom - b.top)) / 2;
      let sideHalf =
        (Math.abs(s) * (b.right - b.left)) / 2 + (Math.abs(c) * (b.bottom - b.top)) / 2;
      if (other.type.startsWith("vehicle-v1:")) {
        const size = physicsBodyDimensions(other),
          relative = vehicleNoseHeading(other) - heading;
        // Separate opposing lanes are not a following queue. Keep yielding to
        // an oncoming car actually occupying our lane, including a player car.
        if (Math.cos(relative) < 0 && side > width + size.depth / 2 + 4) continue;
        alongHalf =
          (Math.abs(Math.cos(relative)) * size.width + Math.abs(Math.sin(relative)) * size.depth) /
          2;
        sideHalf =
          (Math.abs(Math.sin(relative)) * size.width + Math.abs(Math.cos(relative)) * size.depth) /
          2;
      }
      if (ahead <= 0 || side > width + sideHalf + 3) continue;
      const gap = ahead - length - alongHalf;
      const leaderSpeed = Math.max(
        0,
        (other.velocity?.vx ?? 0) * c + (other.velocity?.vy ?? 0) * s,
      );
      speed = Math.min(speed, gap < 14 ? 0 : leaderSpeed + (gap - 14) * 2);
    }
    return Math.max(0, speed);
  }
}

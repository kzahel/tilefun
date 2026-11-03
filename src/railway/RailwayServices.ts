import { required } from "../art/ArtCatalog.js";
import type { Entity } from "../entities/Entity.js";
import { yawRotation } from "../physics/BodyRotation.js";
import { teleportBody } from "../physics/PhysicalEdits.js";
import { PHYSICS_DT } from "../physics/PhysicsDefaults.js";
import type { MotionIntent } from "../physics/PhysicsState.js";
import { RoadType } from "../road/RoadType.js";
import type { PlayerSession } from "../server/PlayerSession.js";
import type { Realm } from "../server/Realm.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import { createCurveTrain, curveOffsets } from "./CurveTrain.js";
import { carriagePose, nearestRail, type RailPath, railAlignment } from "./RailPath.js";
import { besideStationBench } from "./StationBench.js";
import { createTrainCarriages, TRAIN_CARRIAGES } from "./Train.js";

const RAIL_TYPES = new Set<number>([
  RoadType.RailHorizontalTop,
  RoadType.RailHorizontalBottom,
  RoadType.RailCurveProof,
]);
export interface RailRoute {
  id: string;
  y: number;
  start: number;
  end: number;
  path?: RailPath;
  stations: readonly { id: string; x: number; y: number }[];
}
export interface RailSource {
  query(bounds: { minX: number; maxX: number; minY: number; maxY: number }): RailRoute[];
}
interface RecordState {
  version: 2;
  distance: number;
  nextStop: number;
  dwell: number;
  speed: number;
  deleted: boolean;
  pathKey: string;
}
export interface RailService {
  line: RailRoute;
  path: RailPath;
  cars: Entity[];
  record: RecordState;
  removing?: boolean;
}
/** Bounded route intent and lifecycle. Rapier integrates every carriage with the
 * other bodies in the one ordinary scene; there is no rail collision/carry solver. */
export class RailwayServices {
  readonly services = new Map<string, RailService>();
  private pending = new Map<string, Promise<void>>();
  private closed = false;
  private deleted = new Set<string>();
  constructor(
    private readonly realm: Realm,
    private readonly source: RailSource,
  ) {
    realm.entityManager.removalListeners.add((entity, destroyed) => {
      if (!destroyed || this.closed) return;
      for (const s of this.services.values())
        if (!s.removing && s.cars.includes(entity)) {
          s.record.deleted = true;
          this.deleted.add(s.line.id);
          this.dirty(s);
          this.remove(s);
        }
    });
  }
  private path(line: RailRoute): RailPath {
    return (
      line.path ?? {
        closed: false,
        segments: [
          {
            kind: "line",
            x: (line.start - 20) * 16,
            y: line.y * 16,
            endX: (line.end + 20) * 16,
            endY: line.y * 16,
          },
        ],
        stops: line.stations.map((s) => ({ distance: (s.x - line.start + 20) * 16, name: s.id })),
      }
    );
  }
  private range(poses: readonly { x: number; y: number }[]): ChunkRange {
    return {
      minCx: Math.floor((Math.min(...poses.map((p) => p.x)) - 144) / 256),
      maxCx: Math.floor((Math.max(...poses.map((p) => p.x)) + 144) / 256),
      minCy: Math.floor((Math.min(...poses.map((p) => p.y)) - 144) / 256),
      maxCy: Math.floor((Math.max(...poses.map((p) => p.y)) + 144) / 256),
    };
  }
  private poses(s: Pick<RailService, "line" | "path">, distance: number) {
    const a = railAlignment(s.path);
    return s.line.path
      ? curveOffsets(a, distance).map((d) => carriagePose(a, distance + d))
      : TRAIN_CARRIAGES.map((c) => ({ ...a.sample(distance + c.offset), angle: 0 }));
  }
  private dirty(s: RailService) {
    this.realm.saveManager?.markRecordDirty("railServices", s.line.id, () => ({
      collection: "railServices",
      key: s.line.id,
      scope: s.line.id,
      value: { ...s.record },
    }));
  }
  private remove(s: RailService) {
    s.removing = true;
    this.realm.streaming?.interest.release(`rail-service:${s.line.id}`);
    for (const car of s.cars) this.realm.entityManager.remove(car.id);
    this.services.delete(s.line.id);
  }
  private occupied(s: RailService): boolean {
    const ids = new Set(s.cars.map((c) => c.id));
    for (const session of this.realm.sessions.values()) {
      const p = session.player;
      if (
        ids.has(p.parentId ?? -1) ||
        ids.has(this.realm.physicsState?.bodies.find((b) => b.id === p.id)?.supportId ?? -1)
      )
        return true;
      // Jumping roof riders have temporarily left their support manifold.
      if (
        (p.wz ?? 0) > 32 &&
        s.cars.some(
          (c) => Math.hypot(p.position.wx - c.position.wx, p.position.wy - c.position.wy) < 120,
        )
      )
        return true;
    }
    return false;
  }
  async prepare(ranges: readonly ChunkRange[], retire = false) {
    if (this.closed) return;
    const wanted = new Map<string, RailRoute>();
    for (const r of ranges)
      for (const line of this.source.query({
        minX: r.minCx * 16,
        maxX: (r.maxCx + 1) * 16,
        minY: r.minCy * 16,
        maxY: (r.maxCy + 1) * 16,
      }))
        wanted.set(line.id, line);
    for (const s of this.services.values())
      if (retire && !wanted.has(s.line.id) && !this.occupied(s)) {
        this.dirty(s);
        this.remove(s);
      }
    await Promise.all(
      [...wanted.values()].slice(0, 4).map((line) => {
        if (this.services.has(line.id) || this.deleted.has(line.id)) return undefined;
        const pending = this.pending.get(line.id);
        if (pending) return pending;
        if (this.services.size + this.pending.size >= 4) return undefined;
        const task = this.load(line).finally(() => this.pending.delete(line.id));
        this.pending.set(line.id, task);
        return task;
      }),
    );
  }
  private async load(line: RailRoute) {
    const path = this.path(line),
      a = railAlignment(path),
      pathKey = JSON.stringify(path);
    const saved = (await this.realm.saveManager?.store.get("railServices", line.id)) as
      | (Partial<RecordState> & { version?: number; x?: number; target?: number })
      | undefined;
    if (this.closed) return;
    if (saved?.deleted) {
      this.deleted.add(line.id);
      return;
    }
    const oldDistance =
      saved?.distance ?? (saved?.x === undefined ? undefined : saved.x - a.sample(0).x);
    const compatible = !saved?.pathKey || saved.pathKey === pathKey;
    const distance =
      compatible && oldDistance !== undefined && Number.isFinite(oldDistance)
        ? Math.max(240, Math.min(a.length - 240, oldDistance))
        : required(path.stops[0]).distance;
    const nextStop = saved?.nextStop,
      dwell = saved?.dwell;
    const record: RecordState = {
      version: 2,
      distance,
      nextStop:
        compatible &&
        nextStop !== undefined &&
        Number.isInteger(nextStop) &&
        nextStop >= 0 &&
        nextStop < path.stops.length
          ? nextStop
          : 1,
      dwell:
        compatible && dwell !== undefined && Number.isFinite(dwell)
          ? Math.max(0, Math.min(8, dwell))
          : 8,
      speed: 0,
      deleted: false,
      pathKey,
    };
    const poses = this.poses({ line, path }, distance),
      range = this.range(poses);
    await this.realm.streaming?.ensure(range);
    if (this.closed) return;
    const cars = line.path
      ? createCurveTrain(a, distance)
      : createTrainCarriages(required(poses[1]).x, required(poses[1]).y, [0, 0, 0]);
    const s: RailService = { line, path, cars, record };
    cars.forEach((car, i) => {
      car.proceduralId = `${line.id}:car:${i}`;
      car.vehicleHeading = required(poses[i]).angle;
      car.bodyRotation = yawRotation(car.vehicleHeading);
      this.realm.entityManager.spawn(car);
    });
    for (const car of cars) car.physicsGroupId = required(cars[1]).id;
    this.services.set(line.id, s);
    this.demand(s);
    this.dirty(s);
  }
  private demand(s: RailService) {
    const poses = this.poses(s, s.record.distance);
    this.realm.streaming?.interest.set(`rail-service:${s.line.id}`, [
      { range: this.range(poses), activity: 2, reason: "dependency" },
    ]);
  }
  bodies() {
    return [...this.services.values()].flatMap((s) =>
      s.cars.every((c) => !this.realm.streaming || this.realm.streaming.supported(c, PHYSICS_DT))
        ? s.cars
        : [],
    );
  }
  plan(): Map<number, MotionIntent> {
    const intents = new Map<number, MotionIntent>();
    for (const s of this.services.values()) {
      this.demand(s);
      let next = s.record.distance;
      const stop = required(s.path.stops[s.record.nextStop]),
        delta = stop.distance - next;
      if (s.record.dwell > 0) s.record.dwell = Math.max(0, s.record.dwell - PHYSICS_DT);
      else {
        const speed = Math.min(
          192,
          s.record.speed + 96 * PHYSICS_DT,
          Math.sqrt(2 * 192 * Math.abs(delta)),
        );
        next += Math.sign(delta) * Math.min(Math.abs(delta), speed * PHYSICS_DT);
      }
      const poses = this.poses(s, next),
        ready = !this.realm.streaming || this.realm.streaming.rangeReady(this.range(poses));
      const railReady =
        ready &&
        [...this.poses(s, s.record.distance), ...poses].every((p) =>
          [-8, 8].every((side) =>
            RAIL_TYPES.has(
              this.realm.world.getRoadAt(
                Math.floor((p.x - Math.sin(p.angle) * side) / 16),
                Math.floor((p.y + Math.cos(p.angle) * side) / 16),
              ),
            ),
          ),
        );
      for (const [i, c] of s.cars.entries()) {
        const p = required(poses[i]);
        intents.set(c.id, {
          vx: railReady ? (p.x - c.position.wx) / PHYSICS_DT : 0,
          vy: railReady ? (p.y - c.position.wy) / PHYSICS_DT : 0,
          altitude: 0,
          heading: railReady ? p.angle : (c.vehicleHeading ?? p.angle),
        });
      }
    }
    return intents;
  }
  finish() {
    for (const s of this.services.values()) {
      const c = required(s.cars[1]);
      s.record.distance = nearestRail(s.path, c.position.wx, c.position.wy).along;
      s.record.speed = Math.hypot(c.velocity?.vx ?? 0, c.velocity?.vy ?? 0);
      const stop = required(s.path.stops[s.record.nextStop]);
      if (Math.abs(s.record.distance - stop.distance) < 0.5 && s.record.dwell === 0) {
        s.record.distance = stop.distance;
        s.record.speed = 0;
        s.record.dwell = 8;
        s.record.nextStop = s.record.nextStop === 0 ? 1 : 0;
      }
      this.dirty(s);
    }
  }
  async call(session: PlayerSession, benchId: number) {
    const bench = this.realm.propManager.props.find((p) => p.id === benchId);
    const valid = () =>
      !this.closed &&
      !session.transitioning &&
      !session.retired &&
      !this.realm.saveManager?.pressured &&
      session.realmId === this.realm.currentWorldId &&
      !session.editorEnabled &&
      !!bench &&
      this.realm.propManager.props.includes(bench) &&
      besideStationBench(session.player, bench);
    if (!valid() || !bench) throw Error("Stand beside a station bench to call its train.");
    const line = this.source
      .query({
        minX: bench.position.wx / 16 - 2,
        maxX: bench.position.wx / 16 + 2,
        minY: bench.position.wy / 16 - 2,
        maxY: bench.position.wy / 16 + 2,
      })
      .find((l) => l.stations.some((st) => bench.proceduralId?.startsWith(`${st.id}:bench:`)));
    if (!line) throw Error("This bench has no train service.");
    await this.prepare([session.visibleRange]);
    const s = this.services.get(line.id);
    if (!s) throw Error("This train is unavailable.");
    const index = line.stations.findIndex((st) =>
      bench.proceduralId?.startsWith(`${st.id}:bench:`),
    );
    const distance = required(s.path.stops[index]).distance,
      poses = this.poses(s, distance);
    await this.realm.streaming?.ensure(this.range(poses));
    if (!valid() || this.services.get(line.id) !== s || this.occupied(s))
      throw Error("The train has passengers. Wait until everyone gets off.");
    if (!this.realm.canPlaceTrain(s.cars, poses)) throw Error("The station track is blocked.");
    for (const [i, car] of s.cars.entries()) {
      const p = required(poses[i]);
      teleportBody(car, { wx: p.x, wy: p.y, wz: 0 });
      car.velocity = { vx: 0, vy: 0 };
      car.vehicleHeading = p.angle;
      car.bodyRotation = car.prevBodyRotation = yawRotation(p.angle);
      car.bodyAngularVelocity = [0, 0, 0];
    }
    s.record.distance = distance;
    s.record.nextStop = index === 0 ? 1 : 0;
    s.record.dwell = 8;
    s.record.speed = 0;
    this.demand(s);
    this.dirty(s);
  }
  dispose() {
    this.closed = true;
    for (const s of this.services.values()) this.remove(s);
  }
}

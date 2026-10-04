import { required } from "../art/ArtCatalog.js";
import { aabbOverlapsPropWalls, aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import { Direction, type Entity } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import type { PropManager } from "../entities/PropManager.js";
import type { SaveManager } from "../persistence/SaveManager.js";
import { resolveGroundZForTracking } from "../physics/surfaceHeight.js";
import { RoadType } from "../road/RoadType.js";
import type { InterestTicket } from "../server/InterestManager.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import type { World } from "../world/World.js";
import { stepCurvedTrain } from "./CurvedRailMotion.js";
import { createCurveTrain } from "./CurveTrain.js";
import { type RailPath, railAlignment } from "./RailPath.js";
import type { RailLine } from "./RailwayPlanner.js";
import { createTrain, createTrainCarriages, TRAIN_LENGTH } from "./Train.js";

/** Legacy straight tile route, or an opt-in world-pixel alignment with station distances. */
export type RailRoute = Pick<RailLine, "id" | "y" | "start" | "end"> & {
  path?: RailPath;
  /** Authored straight grade proof. Generated services retain their flat whole-train body. */
  surfaceFollowing?: { startZ: number; endZ: number; startAtEnd?: boolean };
};
export interface RailRouteSource {
  query(bounds: { minX: number; maxX: number; minY: number; maxY: number }): RailRoute[];
}

export interface RailServiceRecord {
  version: 1;
  x: number;
  target: 0 | 1;
  dwell: number;
  deleted: boolean;
  /** Curved routes persist arc distance, next stop and exact geometry identity. */
  distance?: number;
  nextStop?: number;
  pathKey?: string;
  heights?: number[];
  speed?: number;
}
export interface RailService {
  line: RailRoute;
  entity: Entity;
  carriages: Entity[];
  record: RailServiceRecord;
  speed: number;
  retiring: boolean;
}
const MAX_SERVICES = 4,
  SPEED = 192,
  ACCEL = 96,
  DWELL = 8;
/** One train per isolated line is an exclusive block: no following/conflicting service exists. */
export class RailwaySystem {
  readonly services = new Map<string, RailService>();
  private pending = new Map<string, Promise<void>>();
  private wanted = new Set<string>();
  private closed = false;
  error: unknown;
  constructor(
    readonly planner: RailRouteSource,
    readonly world: World,
    readonly entities: EntityManager,
    readonly props: PropManager,
    readonly saves: SaveManager,
    readonly prepare?: (range: ChunkRange) => Promise<void>,
  ) {
    entities.removalListeners.add((entity, destroyed) => {
      if (!destroyed) return;
      const state = [...this.services.values()].find((s) => s.carriages.includes(entity));
      if (state) {
        state.record.deleted = true;
        for (const car of state.carriages) if (car.velocity) car.velocity.vx = car.velocity.vy = 0;
        state.speed = 0;
        this.dirty(state);
      }
    });
  }
  private dirty(s: RailService) {
    s.record.x = s.entity.position.wx;
    s.record.speed = s.speed;
    if (s.line.surfaceFollowing) s.record.heights = s.carriages.map((c) => c.wz ?? 0);
    this.saves.markRecordDirty("railServices", s.line.id, () => ({
      collection: "railServices",
      key: s.line.id,
      scope: s.line.id,
      value: { ...s.record },
    }));
  }
  update(players: readonly Entity[]): void {
    if (this.closed) return;
    const nearby = new Map<string, RailRoute>();
    for (const p of players) {
      const x = p.position.wx / 16,
        y = p.position.wy / 16;
      for (const line of this.planner.query({
        minX: x - 128,
        maxX: x + 128,
        minY: y - 128,
        maxY: y + 128,
      }))
        nearby.set(line.id, line);
    }
    this.wanted = new Set([...nearby.keys()].sort().slice(0, MAX_SERVICES));
    for (const id of this.wanted) {
      const line = nearby.get(id);
      if (
        !line ||
        this.services.has(id) ||
        this.pending.has(id) ||
        this.services.size + this.pending.size >= MAX_SERVICES
      )
        continue;
      const task = this.load(line)
        .catch((e) => {
          this.error = e;
        })
        .finally(() => this.pending.delete(id));
      this.pending.set(id, task);
    }
    for (const s of this.services.values())
      if (!this.wanted.has(s.line.id) && !s.retiring) {
        s.retiring = true;
        s.speed = 0;
        for (const car of s.carriages) if (car.velocity) car.velocity.vx = car.velocity.vy = 0;
        this.dirty(s);
        const task = this.saves
          .flushSnapshot()
          .then(() => {
            if (this.wanted.has(s.line.id)) {
              s.retiring = false;
              return;
            }
            for (const car of s.carriages) this.entities.remove(car.id, false);
            this.services.delete(s.line.id);
          })
          .catch((e) => {
            s.retiring = false;
            this.error = e;
          })
          .finally(() => this.pending.delete(s.line.id));
        this.pending.set(s.line.id, task);
      }
  }
  private async load(line: RailRoute) {
    const alignment = line.path ? railAlignment(line.path) : undefined;
    if (alignment && line.surfaceFollowing) throw Error("Curved grades are not supported yet");
    const saved = (await this.saves.store.get("railServices", line.id)) as
      | RailServiceRecord
      | undefined;
    if (this.closed || !this.wanted.has(line.id)) return;
    if (
      saved &&
      (saved.version !== 1 ||
        !Number.isFinite(saved.x) ||
        (!alignment && (saved.x < line.start * 16 || saved.x > line.end * 16)) ||
        (alignment &&
          (!Number.isFinite(saved.distance) ||
            required(saved.distance) < 0 ||
            required(saved.distance) >= alignment.length ||
            !Number.isInteger(saved.nextStop) ||
            required(saved.nextStop) < 0 ||
            required(saved.nextStop) >= alignment.path.stops.length ||
            saved.pathKey !== JSON.stringify(line.path))) ||
        ![0, 1].includes(saved.target) ||
        !Number.isFinite(saved.dwell) ||
        saved.dwell < 0 ||
        saved.dwell > DWELL ||
        typeof saved.deleted !== "boolean" ||
        !Number.isFinite(saved.speed ?? 0) ||
        (saved.speed ?? 0) < 0 ||
        (saved.speed ?? 0) > SPEED ||
        (line.surfaceFollowing &&
          (saved.heights?.length !== 3 ||
            !saved.heights.every((z) => Number.isFinite(z) && Math.abs(z) <= 4096))))
    )
      throw Error("Invalid saved railway service");
    const record: RailServiceRecord = saved ?? {
      version: 1 as const,
      x: (line.surfaceFollowing?.startAtEnd ? line.end : line.start) * 16,
      target: line.surfaceFollowing?.startAtEnd ? (0 as const) : (1 as const),
      dwell: DWELL,
      deleted: false,
    };
    if (alignment && !saved) {
      const initial = line.path?.reverse ? alignment.path.stops.length - 1 : 0;
      record.distance = required(alignment.path.stops[initial]).distance;
      record.target = line.path?.reverse ? 0 : 1;
      record.nextStop =
        (initial + (record.target ? 1 : -1) + alignment.path.stops.length) %
        alignment.path.stops.length;
      record.pathKey = JSON.stringify(line.path);
    }
    const grade = line.surfaceFollowing;
    const carriages = alignment
      ? createCurveTrain(alignment, required(record.distance))
      : grade
        ? createTrainCarriages(
            record.x,
            line.y * 16,
            saved?.heights ?? Array(3).fill(grade.startAtEnd ? grade.endZ : grade.startZ),
          )
        : [createTrain(record.x, line.y * 16)];
    const entity = required(carriages[grade || alignment ? 1 : 0]);
    carriages.forEach((car, i) => {
      car.proceduralId = grade || alignment ? `${line.id}:carriage:${i}` : `${line.id}:train`;
    });
    const state: RailService = {
      line,
      record: { ...record },
      entity,
      carriages,
      speed: saved?.speed ?? 0,
      retiring: false,
    };
    if (!record.deleted) {
      // Restored trains may be far from the observer. Publish only after their
      // complete dependency footprint is ready, not just the player's chunks.
      await this.prepare?.(this.range(state));
      if (this.closed || !this.wanted.has(line.id)) return;
      try {
        for (const car of carriages) this.entities.spawn(car);
      } catch (error) {
        for (const car of carriages) if (car.id) this.entities.remove(car.id, false);
        throw error;
      }
    }
    this.services.set(line.id, state);
    this.dirty(state);
  }
  range(s: RailService): ChunkRange {
    const margin = TRAIN_LENGTH / 2 + 12 + (SPEED * SPEED) / (2 * ACCEL) + 64;
    return {
      minCx: Math.floor((s.entity.position.wx - margin) / 256),
      maxCx: Math.floor((s.entity.position.wx + margin) / 256),
      minCy: Math.floor((s.entity.position.wy - (s.line.path ? margin : 32)) / 256),
      maxCy: Math.floor((s.entity.position.wy + (s.line.path ? margin : 32)) / 256),
    };
  }
  tickets(): InterestTicket[] {
    return [...this.services.values()]
      .filter((s) => !s.record.deleted && !s.retiring)
      .map((s) => ({ range: this.range(s), activity: 2, reason: "dependency" }));
  }
  tick(dt: number, ready: (range: ChunkRange) => boolean) {
    if (this.closed || this.saves.pressured) return;
    for (const s of this.services.values()) {
      const e = s.entity;
      if (s.record.deleted) {
        // Removal listeners run before EntityManager splices the original body.
        // Retire siblings here, outside that mutation, to preserve array/index consistency.
        for (const car of s.carriages) this.entities.remove(car.id, false);
        continue;
      }
      if (s.retiring || !e.velocity || !e.collider) continue;
      for (const car of s.carriages) {
        car.prevPosition = { ...car.position };
        car.prevWz = car.wz ?? 0;
        if (car.velocity) car.velocity.vx = car.velocity.vy = 0;
      }
      if (!ready(this.range(s))) {
        s.speed = 0;
        e.velocity.vx = 0;
        continue;
      }
      const steps = Math.max(1, Math.ceil(Math.min(dt, 1) * 60)),
        step = Math.min(dt, 1) / steps;
      for (let i = 0; i < steps; i++) {
        if (s.line.path) {
          for (const car of s.carriages) if (car.velocity) car.velocity.vx = car.velocity.vy = 0;
          stepCurvedTrain(s, step, this.world, this.entities, this.props);
          continue;
        }
        if (s.record.dwell > 0) {
          s.record.dwell = Math.max(0, s.record.dwell - step);
          s.speed = 0;
          e.velocity.vx = 0;
          continue;
        }
        const destination = (s.record.target === 0 ? s.line.start : s.line.end) * 16;
        const delta = destination - e.position.wx,
          sign = Math.sign(delta),
          distance = Math.abs(delta);
        if (distance < 0.01) {
          e.position.wx = destination;
          s.record.target = s.record.target === 0 ? 1 : 0;
          s.record.dwell = DWELL;
          s.speed = 0;
          e.velocity.vx = 0;
          continue;
        }
        s.speed = Math.min(SPEED, s.speed + ACCEL * step, Math.sqrt(2 * ACCEL * distance));
        const dx = sign * Math.min(distance, s.speed * step);
        const poses = this.probe(s, dx);
        if (!poses) {
          s.speed = 0;
          e.velocity.vx = 0;
          break;
        }
        for (const [j, car] of s.carriages.entries()) {
          car.position.wx += dx;
          car.wz = car.groundZ = required(poses[j]);
          if (car.velocity) car.velocity.vx = dx / step;
          if (car.sprite) {
            car.sprite.direction = sign > 0 ? Direction.Right : Direction.Left;
            car.sprite.frameRow = 0;
            car.sprite.flipX = false;
          }
        }
      }
      for (const car of s.carriages) {
        if (!s.line.path && car.velocity) car.velocity.vx = e.velocity.vx;
        if (car.sprite)
          car.sprite.moving = Math.hypot(car.velocity?.vx ?? 0, car.velocity?.vy ?? 0) > 0;
        this.entities.spatialHash.update(car);
      }
      this.dirty(s);
    }
  }
  /** Probe every carriage before committing any pose; one obstruction stops the service.
   * Small substeps bound grade changes and prevent selecting another stacked floor. */
  private probe(s: RailService, dx: number): number[] | undefined {
    const heights: number[] = [];
    for (const car of s.carriages) {
      const collider = required(car.collider),
        height = collider.physicalHeight ?? 44;
      const position = { wx: car.position.wx + dx, wy: car.position.wy };
      const current = getEntityAABB(car.position, collider),
        next = getEntityAABB(position, collider);
      const swept = {
        left: Math.min(current.left, next.left),
        right: Math.max(current.right, next.right),
        top: current.top,
        bottom: current.bottom,
      };
      const range = {
        minCx: Math.floor(swept.left / 256),
        maxCx: Math.floor(swept.right / 256),
        minCy: Math.floor(swept.top / 256),
        maxCy: Math.floor(swept.bottom / 256),
      };
      for (let tx = Math.floor(swept.left / 16); tx <= Math.floor((swept.right - 0.001) / 16); tx++)
        for (
          let ty = Math.floor(swept.top / 16);
          ty <= Math.floor((swept.bottom - 0.001) / 16);
          ty++
        ) {
          const chunk = this.world.getChunkIfLoaded(Math.floor(tx / 16), Math.floor(ty / 16));
          const road = chunk?.getRoad(((tx % 16) + 16) % 16, ((ty % 16) + 16) % 16);
          if (
            !chunk ||
            ![RoadType.RailHorizontalTop, RoadType.RailHorizontalBottom].includes(road ?? 0) ||
            (!s.line.surfaceFollowing && this.world.getHeightAt(tx, ty) !== 0)
          )
            return;
        }
      const props = this.props.getPropsInChunkRange(
        range.minCx,
        range.minCy,
        range.maxCx,
        range.maxCy,
      );
      const beforeZ = car.wz ?? 0;
      const z = s.line.surfaceFollowing
        ? resolveGroundZForTracking(
            { ...car, position },
            (x, y) => this.world.getHeightAt(x, y),
            props,
            [],
          )
        : 0;
      if (Math.abs(z - beforeZ) > Math.abs(dx) * 0.5 + 0.001) return;
      // On a slope the support itself intersects the swept vertical envelope.
      // Test both endpoint bodies against slabs; substeps move at most 3.2px.
      for (const p of props)
        if (
          aabbOverlapsPropWalls(current, p.position, p, beforeZ, height) ||
          aabbOverlapsPropWalls(next, p.position, p, z, height)
        )
          return;
      for (const other of this.entities.spatialHash.queryRange(
        range.minCx,
        range.minCy,
        range.maxCx,
        range.maxCy,
      )) {
        if (
          s.carriages.includes(other) ||
          !other.collider ||
          other.collider.solid === false ||
          other.flashHidden
        )
          continue;
        const base = other.wz ?? 0;
        if (
          base >= Math.max(z, beforeZ) + height ||
          base + (other.collider.physicalHeight ?? Infinity) <= Math.min(z, beforeZ)
        )
          continue;
        if (aabbsOverlap(swept, getEntityAABB(other.position, other.collider))) return;
      }
      heights.push(z);
    }
    return heights;
  }
  async settle() {
    await Promise.all(this.pending.values());
  }
  async close() {
    this.closed = true;
    await this.settle();
    for (const s of this.services.values()) this.dirty(s);
    await this.saves.flushSnapshot();
  }
}

import { aabbOverlapsPropWalls, aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import { Direction, type Entity } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import type { PropManager } from "../entities/PropManager.js";
import type { SaveManager } from "../persistence/SaveManager.js";
import { RoadType } from "../road/RoadType.js";
import type { InterestTicket } from "../server/InterestManager.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import type { World } from "../world/World.js";
import type { RailLine } from "./RailwayPlanner.js";
import { createTrain, TRAIN_LENGTH } from "./Train.js";

/** Straight horizontal route in tile coordinates, independent of town planning. */
export type RailRoute = Pick<RailLine, "id" | "y" | "start" | "end">;
export interface RailRouteSource {
  query(bounds: { minX: number; maxX: number; minY: number; maxY: number }): RailRoute[];
}

export interface RailServiceRecord {
  version: 1;
  x: number;
  target: 0 | 1;
  dwell: number;
  deleted: boolean;
}
export interface RailService {
  line: RailRoute;
  entity: Entity;
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
  ) {
    entities.removalListeners.add((entity, destroyed) => {
      if (!destroyed) return;
      const state = [...this.services.values()].find((s) => s.entity === entity);
      if (state) {
        state.record.deleted = true;
        state.speed = 0;
        this.dirty(state);
      }
    });
  }
  private dirty(s: RailService) {
    s.record.x = s.entity.position.wx;
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
        if (s.entity.velocity) s.entity.velocity.vx = 0;
        this.dirty(s);
        const task = this.saves
          .flushSnapshot()
          .then(() => {
            if (this.wanted.has(s.line.id)) {
              s.retiring = false;
              return;
            }
            this.entities.remove(s.entity.id, false);
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
    const saved = (await this.saves.store.get("railServices", line.id)) as
      | RailServiceRecord
      | undefined;
    if (this.closed || !this.wanted.has(line.id)) return;
    if (
      saved &&
      (saved.version !== 1 ||
        !Number.isFinite(saved.x) ||
        saved.x < line.start * 16 ||
        saved.x > line.end * 16 ||
        ![0, 1].includes(saved.target) ||
        !Number.isFinite(saved.dwell) ||
        saved.dwell < 0 ||
        saved.dwell > DWELL ||
        typeof saved.deleted !== "boolean")
    )
      throw Error("Invalid saved railway service");
    const record = saved ?? {
      version: 1 as const,
      x: line.start * 16,
      target: 1 as const,
      dwell: DWELL,
      deleted: false,
    };
    const entity = createTrain(record.x, line.y * 16);
    entity.proceduralId = `${line.id}:train`;
    const state = { line, record: { ...record }, entity, speed: 0, retiring: false };
    this.services.set(line.id, state);
    if (!record.deleted) this.entities.spawn(entity);
    this.dirty(state);
  }
  range(s: RailService): ChunkRange {
    const margin = TRAIN_LENGTH / 2 + (SPEED * SPEED) / (2 * ACCEL) + 64;
    return {
      minCx: Math.floor((s.entity.position.wx - margin) / 256),
      maxCx: Math.floor((s.entity.position.wx + margin) / 256),
      minCy: Math.floor((s.entity.position.wy - 32) / 256),
      maxCy: Math.floor((s.entity.position.wy + 32) / 256),
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
      if (s.record.deleted || s.retiring || !e.velocity || !e.collider) continue;
      e.prevPosition = { ...e.position };
      e.velocity.vx = 0;
      if (!ready(this.range(s))) {
        s.speed = 0;
        e.velocity.vx = 0;
        continue;
      }
      const steps = Math.max(1, Math.ceil(Math.min(dt, 1) * 60)),
        step = Math.min(dt, 1) / steps;
      for (let i = 0; i < steps; i++) {
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
        const current = getEntityAABB(e.position, e.collider),
          next = getEntityAABB({ wx: e.position.wx + dx, wy: e.position.wy }, e.collider);
        const swept = {
          left: Math.min(current.left, next.left),
          right: Math.max(current.right, next.right),
          top: current.top,
          bottom: current.bottom,
        };
        let blocked = false;
        for (let tx = Math.floor(swept.left / 16); tx <= Math.floor(swept.right / 16); tx++)
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
              this.world.getHeightAt(tx, ty) !== 0
            )
              blocked = true;
          }
        for (const other of this.entities.spatialHash.queryRange(
          Math.floor(swept.left / 256),
          Math.floor(swept.top / 256),
          Math.floor(swept.right / 256),
          Math.floor(swept.bottom / 256),
        ))
          if (
            other !== e &&
            other.collider &&
            other.collider.solid !== false &&
            (other.wz ?? 0) < 44 &&
            (other.wz ?? 0) + (other.collider.physicalHeight ?? Infinity) > 0 &&
            aabbsOverlap(swept, getEntityAABB(other.position, other.collider))
          )
            blocked = true;
        for (const p of this.props.getPropsInChunkRange(
          Math.floor(swept.left / 256),
          Math.floor(swept.top / 256),
          Math.floor(swept.right / 256),
          Math.floor(swept.bottom / 256),
        ))
          if (aabbOverlapsPropWalls(swept, p.position, p, 0, 44)) blocked = true;
        if (blocked) {
          s.speed = 0;
          e.velocity.vx = 0;
          break;
        }
        e.position.wx += dx;
        e.velocity.vx = dx / step;
        if (e.sprite) {
          e.sprite.direction = sign > 0 ? Direction.Right : Direction.Left;
          e.sprite.frameRow = 0;
          e.sprite.flipX = false;
        }
      }
      if (e.sprite) e.sprite.moving = e.velocity.vx !== 0;
      this.entities.spatialHash.update(e);
      this.dirty(s);
    }
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

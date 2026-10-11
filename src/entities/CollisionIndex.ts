import type { AABB } from "./collision.js";
import type { Entity } from "./Entity.js";

interface Membership {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  epoch: number;
  query: number;
  oversized: boolean;
  keys: string[];
}

/**
 * Body broad phase for one synchronous EntityManager movement/ground pass.
 * Rebuild from all resident bodies before movement (including sleepers and edits),
 * then refresh each moved body before another actor can query it. After movement,
 * finish freezes XY membership for read-only ground queries with live support Z.
 * Stop querying before separation/attachments can move bodies again. Sparse
 * ground, visibility and residency queries remain owned by SpatialHash.
 */
export class CollisionIndex {
  private readonly cells = new Map<string, Entity[]>();
  private readonly pool: Entity[][] = [];
  private readonly membership = new WeakMap<Entity, Membership>();
  private readonly oversized = new Set<Entity>();
  private bodies: readonly Entity[] = [];
  private epoch = 0;
  private querySerial = 0;
  private moving = false;

  constructor(readonly cellSize = 32) {
    if (!Number.isFinite(cellSize) || cellSize <= 0) throw new Error("Invalid collision cell size");
  }

  rebuild(entities: readonly Entity[]): void {
    this.moving = true;
    for (const bucket of this.cells.values()) {
      bucket.length = 0;
      this.pool.push(bucket);
    }
    this.cells.clear();
    this.oversized.clear();
    this.bodies = entities;
    this.epoch++;
    for (const entity of entities) this.update(entity);
  }

  update(entity: Entity): void {
    if (!this.moving) return;
    const old = this.membership.get(entity);
    const collider = entity.collider;
    if (!collider || collider.solid === false) {
      if (old?.epoch === this.epoch) this.unindex(entity, old);
      return;
    }
    const { wx, wy } = entity.position;
    const minX = Math.floor((wx + collider.offsetX - collider.width / 2) / this.cellSize);
    const minY = Math.floor((wy + collider.offsetY - collider.height) / this.cellSize);
    const maxX = Math.floor((wx + collider.offsetX + collider.width / 2) / this.cellSize);
    const maxY = Math.floor((wy + collider.offsetY) / this.cellSize);
    const sameCells =
      old && old.minX === minX && old.minY === minY && old.maxX === maxX && old.maxY === maxY;
    if (old?.epoch === this.epoch && sameCells) return;
    if (old?.epoch === this.epoch) this.unindex(entity, old);
    const state = old ?? { minX, minY, maxX, maxY, epoch: 0, query: 0, oversized: false, keys: [] };
    state.minX = minX;
    state.minY = minY;
    state.maxX = maxX;
    state.maxY = maxY;
    state.epoch = this.epoch;
    // Edited oversized bodies must remain discoverable without filling millions
    // of cells. Ordinary seam-crossing bodies use only their intersected cells.
    state.oversized =
      !Number.isFinite(minX + minY + maxX + maxY) || (maxX - minX + 1) * (maxY - minY + 1) > 256;
    if (!old) this.membership.set(entity, state);
    if (state.oversized) {
      this.oversized.add(entity);
      return;
    }
    if (!sameCells) {
      state.keys.length = 0;
      for (let y = minY; y <= maxY; y++)
        for (let x = minX; x <= maxX; x++) state.keys.push(`${x},${y}`);
    }
    for (const key of state.keys) {
      let bucket = this.cells.get(key);
      if (!bucket) {
        bucket = this.pool.pop() ?? [];
        this.cells.set(key, bucket);
      }
      bucket.push(entity);
    }
  }

  remove(entity: Entity): void {
    const state = this.membership.get(entity);
    if (state?.epoch === this.epoch) this.unindex(entity, state);
  }

  /** Stop movement refreshes; read-only queries remain valid until later XY edits. */
  finish(): void {
    this.moving = false;
  }

  private unindex(entity: Entity, state: Membership): void {
    if (state.oversized) this.oversized.delete(entity);
    else
      for (const key of state.keys) {
        const bucket = this.cells.get(key);
        const i = bucket?.indexOf(entity) ?? -1;
        if (bucket && i >= 0) {
          const last = bucket[bucket.length - 1];
          if (last) bucket[i] = last;
          bucket.pop();
        }
      }
    state.epoch = -1;
  }

  /** Conservative cell candidates, unique per query; callers read live geometry. */
  query(box: AABB): Entity[] {
    const minX = Math.floor(box.left / this.cellSize);
    const minY = Math.floor(box.top / this.cellSize);
    const maxX = Math.floor(box.right / this.cellSize);
    const maxY = Math.floor(box.bottom / this.cellSize);
    if (!Number.isFinite(minX + minY + maxX + maxY) || (maxX - minX + 1) * (maxY - minY + 1) > 256)
      return this.bodies.filter(
        (entity) =>
          entity.collider &&
          entity.collider.solid !== false &&
          this.membership.get(entity)?.epoch === this.epoch,
      );
    const result: Entity[] = [];
    const query = ++this.querySerial;
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        for (const entity of this.cells.get(`${x},${y}`) ?? []) {
          const state = this.membership.get(entity);
          if (!state || state.query === query) continue;
          state.query = query;
          result.push(entity);
        }
      }
    for (const entity of this.oversized) result.push(entity);
    return result;
  }
}

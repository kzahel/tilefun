import { CHUNK_SIZE_PX } from "../config/constants.js";
import type { Entity } from "./Entity.js";

/**
 * Spatial hash grid for fast entity lookups by position.
 * Cell size = 1 chunk (CHUNK_SIZE_PX = 256px).
 *
 * This is a secondary index over EntityManager.entities[].
 * EntityManager remains the authority — this is rebuilt on movement.
 */
export class SpatialHash {
  /** cell key → set of entities in that cell */
  private cells = new Map<number, Entity[]>();
  /** entity id → current cell key */
  private entityCell = new Map<number, number>();

  /** Pack chunk coordinates into a single integer key. Handles negative coords up to +-32767. */
  private static key(cx: number, cy: number): number {
    return ((cx + 0x8000) << 16) | ((cy + 0x8000) & 0xffff);
  }

  /** World position → chunk coordinate. */
  private static toChunk(w: number): number {
    return Math.floor(w / CHUNK_SIZE_PX);
  }

  /** Add an entity to the hash. */
  insert(entity: Entity): void {
    const cx = SpatialHash.toChunk(entity.position.wx);
    const cy = SpatialHash.toChunk(entity.position.wy);
    const k = SpatialHash.key(cx, cy);
    this.entityCell.set(entity.id, k);
    let bucket = this.cells.get(k);
    if (!bucket) {
      bucket = [];
      this.cells.set(k, bucket);
    }
    bucket.push(entity);
  }

  /** Remove an entity from the hash. */
  remove(entity: Entity): void {
    const k = this.entityCell.get(entity.id);
    if (k === undefined) return;
    this.entityCell.delete(entity.id);
    const bucket = this.cells.get(k);
    if (bucket) {
      const idx = bucket.indexOf(entity);
      if (idx >= 0) {
        // Swap-remove for O(1)
        const last = bucket[bucket.length - 1];
        if (last) bucket[idx] = last;
        bucket.pop();
      }
      if (bucket.length === 0) this.cells.delete(k);
    }
  }

  /** Update an entity's cell if it crossed a chunk boundary. */
  update(entity: Entity): void {
    const cx = SpatialHash.toChunk(entity.position.wx);
    const cy = SpatialHash.toChunk(entity.position.wy);
    const newKey = SpatialHash.key(cx, cy);
    const oldKey = this.entityCell.get(entity.id);
    if (oldKey === newKey) return;
    // Remove from old bucket
    if (oldKey !== undefined) {
      const bucket = this.cells.get(oldKey);
      if (bucket) {
        const idx = bucket.indexOf(entity);
        if (idx >= 0) {
          const last = bucket[bucket.length - 1];
          if (last) bucket[idx] = last;
          bucket.pop();
        }
        if (bucket.length === 0) this.cells.delete(oldKey);
      }
    }
    // Insert into new bucket
    this.entityCell.set(entity.id, newKey);
    let bucket = this.cells.get(newKey);
    if (!bucket) {
      bucket = [];
      this.cells.set(newKey, bucket);
    }
    bucket.push(entity);
  }

  /** Query all entities in a chunk coordinate range (inclusive). */
  queryRange(minCx: number, minCy: number, maxCx: number, maxCy: number): Entity[] {
    const result: Entity[] = [];
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const bucket = this.cells.get(SpatialHash.key(cx, cy));
        if (bucket) {
          for (const e of bucket) result.push(e);
        }
      }
    }
    return result;
  }

  /** Query entities near a world position within a radius (in world pixels). */
  queryRadius(wx: number, wy: number, radius: number): Entity[] {
    const minCx = SpatialHash.toChunk(wx - radius);
    const minCy = SpatialHash.toChunk(wy - radius);
    const maxCx = SpatialHash.toChunk(wx + radius);
    const maxCy = SpatialHash.toChunk(wy + radius);
    const r2 = radius * radius;
    const result: Entity[] = [];
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const bucket = this.cells.get(SpatialHash.key(cx, cy));
        if (bucket) {
          for (const e of bucket) {
            const dx = e.position.wx - wx;
            const dy = e.position.wy - wy;
            if (dx * dx + dy * dy <= r2) result.push(e);
          }
        }
      }
    }
    return result;
  }

  /** Get entities in a single chunk cell. */
  getCell(cx: number, cy: number): readonly Entity[] {
    return this.cells.get(SpatialHash.key(cx, cy)) ?? [];
  }

  /** Clear all data. */
  clear(): void {
    this.cells.clear();
    this.entityCell.clear();
  }
}

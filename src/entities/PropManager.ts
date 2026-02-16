import { CHUNK_SIZE_PX } from "../config/constants.js";
import type { AABB } from "./collision.js";
import { aabbsOverlap, getEntityAABB } from "./collision.js";
import type { Prop, PropCollider } from "./Prop.js";

function chunkKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

/** Simple store for static props. No update loop — props don't tick. */
export class PropManager {
  readonly props: Prop[] = [];
  private nextId = 1;
  private chunkIndex = new Map<string, Prop[]>();
  /** Monotonic revision counter — incremented on add/remove for delta sync. */
  revision = 0;

  getNextId(): number {
    return this.nextId;
  }

  setNextId(n: number): void {
    this.nextId = n;
  }

  /**
   * Compute the chunk-coordinate range covering all of a prop's collision shapes.
   * Props with no colliders fall back to a single chunk based on center position.
   */
  private getPropChunkRange(prop: Prop): {
    minCx: number;
    minCy: number;
    maxCx: number;
    maxCy: number;
  } {
    const colliders: PropCollider[] = [];
    if (prop.walls) {
      for (const w of prop.walls) colliders.push(w);
    }
    if (prop.collider) {
      colliders.push(prop.collider);
    }

    if (colliders.length === 0) {
      const cx = Math.floor(prop.position.wx / CHUNK_SIZE_PX);
      const cy = Math.floor(prop.position.wy / CHUNK_SIZE_PX);
      return { minCx: cx, minCy: cy, maxCx: cx, maxCy: cy };
    }

    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const c of colliders) {
      const aabb = getEntityAABB(prop.position, c);
      left = Math.min(left, aabb.left);
      top = Math.min(top, aabb.top);
      right = Math.max(right, aabb.right);
      bottom = Math.max(bottom, aabb.bottom);
    }

    return {
      minCx: Math.floor(left / CHUNK_SIZE_PX),
      minCy: Math.floor(top / CHUNK_SIZE_PX),
      maxCx: Math.floor(right / CHUNK_SIZE_PX),
      maxCy: Math.floor(bottom / CHUNK_SIZE_PX),
    };
  }

  /** Add prop to chunk index bucket, creating if needed. */
  private indexProp(key: string, prop: Prop): void {
    let bucket = this.chunkIndex.get(key);
    if (!bucket) {
      bucket = [];
      this.chunkIndex.set(key, bucket);
    }
    bucket.push(prop);
  }

  /** Remove prop from chunk index bucket, cleaning up empty buckets. */
  private unindexProp(key: string, prop: Prop): void {
    const bucket = this.chunkIndex.get(key);
    if (bucket) {
      const bi = bucket.indexOf(prop);
      if (bi >= 0) bucket.splice(bi, 1);
      if (bucket.length === 0) this.chunkIndex.delete(key);
    }
  }

  add(prop: Prop): Prop {
    prop.id = this.nextId++;
    this.props.push(prop);
    this.revision++;
    const { minCx, minCy, maxCx, maxCy } = this.getPropChunkRange(prop);
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        this.indexProp(chunkKey(cx, cy), prop);
      }
    }
    return prop;
  }

  remove(id: number): boolean {
    const idx = this.props.findIndex((p) => p.id === id);
    if (idx < 0) return false;
    const prop = this.props[idx];
    if (!prop) return false;
    this.props.splice(idx, 1);
    this.revision++;
    const { minCx, minCy, maxCx, maxCy } = this.getPropChunkRange(prop);
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        this.unindexProp(chunkKey(cx, cy), prop);
      }
    }
    return true;
  }

  /** Check if an AABB overlaps any existing prop collider (chunk-indexed). */
  overlapsAnyProp(aabb: AABB): boolean {
    const minCx = Math.floor(aabb.left / CHUNK_SIZE_PX);
    const maxCx = Math.floor(aabb.right / CHUNK_SIZE_PX);
    const minCy = Math.floor(aabb.top / CHUNK_SIZE_PX);
    const maxCy = Math.floor(aabb.bottom / CHUNK_SIZE_PX);
    for (const prop of this.getPropsInChunkRange(minCx, minCy, maxCx, maxCy)) {
      if (prop.collider && aabbsOverlap(aabb, getEntityAABB(prop.position, prop.collider))) {
        return true;
      }
    }
    return false;
  }

  /** Return props near an entity's position based on its collider footprint. */
  getPropsNearPosition(position: { wx: number; wy: number }, collider: PropCollider): Prop[] {
    const footprint = getEntityAABB(position, collider);
    return this.getPropsInChunkRange(
      Math.floor(footprint.left / CHUNK_SIZE_PX),
      Math.floor(footprint.top / CHUNK_SIZE_PX),
      Math.floor(footprint.right / CHUNK_SIZE_PX),
      Math.floor(footprint.bottom / CHUNK_SIZE_PX),
    );
  }

  /** Return all props whose chunk falls within the given chunk-coordinate rectangle. */
  getPropsInChunkRange(minCx: number, minCy: number, maxCx: number, maxCy: number): Prop[] {
    const result: Prop[] = [];
    const seen = new Set<number>();
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const bucket = this.chunkIndex.get(chunkKey(cx, cy));
        if (bucket) {
          for (const p of bucket) {
            if (!seen.has(p.id)) {
              seen.add(p.id);
              result.push(p);
            }
          }
        }
      }
    }
    return result;
  }
}

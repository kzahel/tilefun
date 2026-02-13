import { CHUNK_SIZE_PX } from "../config/constants.js";
import type { AABB } from "./collision.js";
import { aabbsOverlap, getEntityAABB } from "./collision.js";
import type { Prop } from "./Prop.js";

function chunkKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

/** Simple store for static props. No update loop — props don't tick. */
export class PropManager {
  readonly props: Prop[] = [];
  private nextId = 1;
  private chunkIndex = new Map<string, Prop[]>();

  getNextId(): number {
    return this.nextId;
  }

  setNextId(n: number): void {
    this.nextId = n;
  }

  add(prop: Prop): Prop {
    prop.id = this.nextId++;
    this.props.push(prop);
    const key = chunkKey(
      Math.floor(prop.position.wx / CHUNK_SIZE_PX),
      Math.floor(prop.position.wy / CHUNK_SIZE_PX),
    );
    let bucket = this.chunkIndex.get(key);
    if (!bucket) {
      bucket = [];
      this.chunkIndex.set(key, bucket);
    }
    bucket.push(prop);
    return prop;
  }

  remove(id: number): boolean {
    const idx = this.props.findIndex((p) => p.id === id);
    if (idx < 0) return false;
    const prop = this.props[idx];
    if (!prop) return false;
    this.props.splice(idx, 1);
    const key = chunkKey(
      Math.floor(prop.position.wx / CHUNK_SIZE_PX),
      Math.floor(prop.position.wy / CHUNK_SIZE_PX),
    );
    const bucket = this.chunkIndex.get(key);
    if (bucket) {
      const bi = bucket.indexOf(prop);
      if (bi >= 0) bucket.splice(bi, 1);
      if (bucket.length === 0) this.chunkIndex.delete(key);
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

  /** Return all props whose chunk falls within the given chunk-coordinate rectangle. */
  getPropsInChunkRange(minCx: number, minCy: number, maxCx: number, maxCy: number): Prop[] {
    const result: Prop[] = [];
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const bucket = this.chunkIndex.get(chunkKey(cx, cy));
        if (bucket) {
          for (const p of bucket) result.push(p);
        }
      }
    }
    return result;
  }
}

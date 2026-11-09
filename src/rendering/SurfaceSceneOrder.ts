import { type AABB, getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import type { Prop, PropCollider } from "../entities/Prop.js";
import { type SurfacePatch, surfaceZAt } from "../physics/SurfacePatch.js";
import type { SceneItem } from "./SceneItem.js";
import { nearbySurfaceTop, type SurfaceVisibility, surfaceDisplay } from "./SurfacePresentation.js";
import { planeZ } from "./SurfaceReceivers.js";

/** One planar slab in prop order; the first occurrence of an id wins, as `find` did. */
export interface Slab {
  readonly prop: Prop;
  readonly collider: PropCollider;
  readonly patch: SurfacePatch;
  readonly bounds: AABB;
}

export function surfaceSlabs(props: readonly Prop[]): Slab[] {
  const slabs: Slab[] = [];
  for (const prop of props) {
    if (!prop.walls && !prop.collider?.surface) continue;
    for (const collider of prop.walls ?? (prop.collider ? [prop.collider] : []))
      if (collider.surface)
        slabs.push({
          prop,
          collider,
          patch: collider.surface,
          bounds: getEntityAABB(prop.position, collider),
        });
  }
  return slabs;
}

/** Item extents that do not depend on the slab, computed once per frame. */
interface Extent {
  readonly index: number;
  readonly minX: number;
  readonly maxX: number;
  /** Projected lowest (largest y−z) and highest screen rows. */
  readonly bottom: number;
  readonly highest: number;
  readonly z: number;
}

function itemExtent(item: SceneItem, index: number): Extent | undefined {
  if (item.kind === "decal") {
    let minX = Infinity,
      maxX = -Infinity,
      bottom = -Infinity,
      highest = Infinity;
    for (const polygon of item.polygons)
      for (const v of polygon) {
        minX = Math.min(minX, v.x);
        maxX = Math.max(maxX, v.x);
        const y = v.y - planeZ(item.plane, v.x, v.y);
        bottom = Math.max(bottom, y);
        highest = Math.min(highest, y);
      }
    return { index, minX, maxX, bottom, highest, z: item.z };
  }
  if (item.kind === "sprite") {
    const bottom = item.wy - item.zOffset + item.drawOffsetY;
    return {
      index,
      minX: item.wx - item.spriteWidth / 2,
      maxX: item.wx + item.spriteWidth / 2,
      bottom,
      highest: bottom - item.spriteHeight * (item.scaleY ?? 1),
      z: item.zOffset,
    };
  }
  if (item.kind === "particle") {
    const bottom = item.wy - item.z + item.size;
    return {
      index,
      minX: item.wx - item.size,
      maxX: item.wx + item.size,
      bottom,
      highest: bottom - item.size * 2,
      z: item.z,
    };
  }
  return undefined;
}

/** Coarse buckets so each slab only tests nearby items. The exact per-pair test
 * below is unchanged; buckets only skip pairs whose bounds cannot overlap. */
const CELL = 512;
const MAX_CELLS = 4096;
class ExtentGrid {
  private readonly cells = new Map<number, Extent[]>();
  private readonly unbounded: Extent[] = [];
  private readonly stamp: Int32Array;
  private query = 0;
  constructor(
    private readonly all: readonly Extent[],
    size: number,
  ) {
    this.stamp = new Int32Array(size);
    for (const e of all)
      if (!this.each(e.minX, e.maxX, e.highest, e.bottom, e)) this.unbounded.push(e);
  }
  /** False when the range is non-finite or too large to bucket. */
  private each(minX: number, maxX: number, minY: number, maxY: number, add?: Extent): boolean {
    const x0 = Math.floor(minX / CELL),
      x1 = Math.floor(maxX / CELL),
      y0 = Math.floor(minY / CELL),
      y1 = Math.floor(maxY / CELL);
    if (!Number.isFinite(x0 + x1 + y0 + y1) || x1 < x0 || y1 < y0) return false;
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > MAX_CELLS) return false;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const key = x * 0x200000 + y;
        if (add) {
          const cell = this.cells.get(key);
          if (cell) cell.push(add);
          else this.cells.set(key, [add]);
        } else this.take(this.cells.get(key));
      }
    return true;
  }
  private visit: (e: Extent) => void = () => {};
  private take(cell: readonly Extent[] | undefined): void {
    if (!cell) return;
    for (const e of cell) {
      if (this.stamp[e.index] === this.query) continue;
      this.stamp[e.index] = this.query;
      this.visit(e);
    }
  }
  /** Each candidate at most once per query, in no particular order. */
  near(minX: number, maxX: number, minY: number, maxY: number, visit: (e: Extent) => void): void {
    this.query++;
    this.visit = visit;
    if (!this.each(minX, maxX, minY, maxY)) this.take(this.all);
    else this.take(this.unbounded);
  }
}

/** Minimal binary min-heap of node indices. */
class MinHeap {
  private readonly items: number[] = [];
  get size(): number {
    return this.items.length;
  }
  /** Ascending pushes onto an empty heap need no sifting. */
  pushAscending(value: number): void {
    this.items.push(value);
  }
  push(value: number): void {
    const items = this.items;
    let i = items.length;
    items.push(value);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      const p = items[parent] as number;
      if (p <= value) break;
      items[i] = p;
      i = parent;
    }
    items[i] = value;
  }
  pop(): number {
    const items = this.items;
    const top = items[0] as number;
    const last = items.pop() as number;
    if (!items.length) return top;
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      if (l >= items.length) break;
      const r = l + 1;
      const c = r < items.length && (items[r] as number) < (items[l] as number) ? r : l;
      if ((items[c] as number) >= last) break;
      items[i] = items[c] as number;
      i = c;
    }
    items[i] = last;
    return top;
  }
}

/** Lowest-index ready node first; on a cycle, the lowest-index remaining node.
 * The heap keeps large overview scenes O(n log n) instead of O(n²). */
export function orderNodes(count: number, edges: readonly (readonly number[])[]): number[] {
  const degree = new Int32Array(count);
  for (const targets of edges) for (const to of targets) degree[to] = (degree[to] ?? 0) + 1;
  const ready = new MinHeap();
  for (let i = 0; i < count; i++) if (degree[i] === 0) ready.pushAscending(i);
  const emitted = new Uint8Array(count);
  const result: number[] = [];
  let fallback = 0;
  const next = (): number => {
    while (ready.size) {
      const candidate = ready.pop();
      if (!emitted[candidate]) return candidate;
    }
    while (emitted[fallback]) fallback++;
    return fallback;
  };
  while (result.length < count) {
    const index = next();
    emitted[index] = 1;
    result.push(index);
    for (const to of edges[index] ?? []) {
      const remaining = (degree[to] ?? 0) - 1;
      degree[to] = remaining;
      if (remaining === 0 && !emitted[to]) ready.push(to);
    }
  }
  return result;
}

/** Surface-bearing props in original order, and each slab id's first owner. */
export function slabLookup(slabs: readonly Slab[]): {
  planarProps: Prop[];
  byId: Map<string, Slab>;
} {
  const planarProps: Prop[] = [];
  const byId = new Map<string, Slab>();
  for (const slab of slabs) {
    if (planarProps.at(-1) !== slab.prop) planarProps.push(slab.prop);
    if (!byId.has(slab.patch.id)) byId.set(slab.patch.id, slab);
  }
  return { planarProps, byId };
}

/** Stable painter constraints for bounded planar slabs. Each actor is ordered
 * against the slab at its own height; only visibility is observer-dependent.
 * This avoids drawing a lower train over a bridge just because the player is on it.
 * Arbitrarily intersecting surfaces/meshes still require a general depth solution.
 */
export function surfaceSceneOrder(
  items: readonly SceneItem[],
  props: readonly Prop[],
  observer: Entity,
  mode: SurfaceVisibility,
  alpha: number,
): (number | string)[] {
  return slabSceneOrder(items, surfaceSlabs(props), observer, mode, alpha);
}

export function slabSceneOrder(
  items: readonly SceneItem[],
  slabs: readonly Slab[],
  observer: Entity,
  mode: SurfaceVisibility,
  alpha: number,
): (number | string)[] {
  const count = items.length + slabs.length;
  const edges: number[][] = Array.from({ length: count }, () => []);
  const extents: Extent[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const extent = item && itemExtent(item, i);
    if (extent) extents.push(extent);
  }
  const grid = slabs.length && extents.length ? new ExtentGrid(extents, items.length) : undefined;
  for (const [j, { patch, bounds }] of slabs.entries()) {
    // A revealed slab keeps its order so it is drawn translucent over the observer.
    if (!grid || surfaceDisplay(patch, bounds, observer, mode, alpha) === "hidden") continue;
    const slab = items.length + j;
    // z is linear in x, so the clipped north/south rows lie within these.
    const northRow = Math.min(
      bounds.top - surfaceZAt(patch, bounds, bounds.left, bounds.top),
      bounds.top - surfaceZAt(patch, bounds, bounds.right, bounds.top),
    );
    const southRow =
      Math.max(
        bounds.bottom - surfaceZAt(patch, bounds, bounds.left, bounds.bottom),
        bounds.bottom - surfaceZAt(patch, bounds, bounds.right, bounds.bottom),
      ) + patch.thickness;
    grid.near(bounds.left, bounds.right, northRow, southRow, (e) => {
      const left = Math.max(bounds.left, e.minX);
      const right = Math.min(bounds.right, e.maxX);
      if (left >= right) return;
      const north = Math.min(
        bounds.top - surfaceZAt(patch, bounds, left, bounds.top),
        bounds.top - surfaceZAt(patch, bounds, right, bounds.top),
      );
      const south =
        Math.max(
          bounds.bottom - surfaceZAt(patch, bounds, left, bounds.bottom),
          bounds.bottom - surfaceZAt(patch, bounds, right, bounds.bottom),
        ) + patch.thickness;
      if (e.bottom <= north || e.highest >= south) return;
      const item = items[e.index] as SceneItem & { wx: number; wy: number };
      const top = nearbySurfaceTop(patch, bounds, {
        left: item.wx,
        right: item.wx,
        top: item.wy,
        bottom: item.wy,
      });
      if (e.z < top - 1) edges[e.index]?.push(slab);
      else edges[slab]?.push(e.index);
    });
  }
  return orderNodes(count, edges).map((node) =>
    node < items.length ? node : (slabs[node - items.length] as Slab).patch.id,
  );
}

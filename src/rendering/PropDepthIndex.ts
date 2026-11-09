import type { AABB } from "../entities/collision.js";
import type { PropDepthSurface } from "./propDepth.js";

/** Coarse buckets over depth surfaces. Large scenes (overview zoom, crowded cities)
 * otherwise test every actor against every prop top. Lookups may repeat a surface;
 * the depth result is a maximum, so order and repeats do not change it. */
const DEPTH_CELL = 256;
const MAX_DEPTH_CELLS = 1024;
export class PropDepthIndex {
  private readonly cells = new Map<number, PropDepthSurface[]>();
  private readonly unbounded: PropDepthSurface[] = [];
  constructor(readonly surfaces: readonly PropDepthSurface[]) {
    for (const surface of surfaces) {
      const { left, right, top, bottom } = surface.bounds;
      if (!this.cellsOf(left, right, top, bottom, surface)) this.unbounded.push(surface);
    }
  }
  private cellsOf(
    left: number,
    right: number,
    top: number,
    bottom: number,
    add?: PropDepthSurface,
    visit?: (surface: PropDepthSurface) => void,
  ): boolean {
    const x0 = Math.floor(left / DEPTH_CELL),
      x1 = Math.floor(right / DEPTH_CELL),
      y0 = Math.floor(top / DEPTH_CELL),
      y1 = Math.floor(bottom / DEPTH_CELL);
    if (!Number.isFinite(x0 + x1 + y0 + y1) || x1 < x0 || y1 < y0) return false;
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > MAX_DEPTH_CELLS) return false;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const key = x * 0x200000 + y;
        if (add) {
          const cell = this.cells.get(key);
          if (cell) cell.push(add);
          else this.cells.set(key, [add]);
        } else if (visit) for (const surface of this.cells.get(key) ?? []) visit(surface);
      }
    return true;
  }
  /** Every surface that can overlap the footprint, possibly more than once. */
  near(footprint: AABB, visit: (surface: PropDepthSurface) => void): void {
    const { left, right, top, bottom } = footprint;
    if (!this.cellsOf(left, right, top, bottom, undefined, visit)) {
      for (const surface of this.surfaces) visit(surface);
      return;
    }
    for (const surface of this.unbounded) visit(surface);
  }
}

/** Below this, a linear scan is cheaper than building buckets. */
const INDEX_MIN_SURFACES = 64;
export function propDepthLookup(
  surfaces: readonly PropDepthSurface[],
): readonly PropDepthSurface[] | PropDepthIndex {
  return surfaces.length < INDEX_MIN_SURFACES ? surfaces : new PropDepthIndex(surfaces);
}

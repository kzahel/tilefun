import { ELEVATION_PX, TILE_SIZE } from "../config/constants.js";
import type { AABB } from "../entities/collision.js";
import type { PropCollider } from "../entities/Prop.js";

/** A convex slice of a building in native pixels about its feet. The front edge,
 * roof and soffit interpolate between the two X ends (bays, gables and eaves). */
export interface BuildingSection {
  left: number;
  right: number;
  back: number;
  front: number;
  frontRight: number;
  top: number;
  topRight: number;
  base: number;
  baseRight: number;
}
export function section(
  left: number,
  right: number,
  back: number,
  front: number,
  top: number,
  shape: Partial<Pick<BuildingSection, "topRight" | "base" | "baseRight" | "frontRight">> = {},
): BuildingSection {
  return {
    left,
    right,
    back,
    front,
    top,
    frontRight: front,
    topRight: top,
    base: 0,
    baseRight: shape.base ?? 0,
    ...shape,
  };
}

export function sectionBounds(s: BuildingSection): PropCollider {
  const front = Math.max(s.front, s.frontRight);
  const base = Math.min(s.base, s.baseRight);
  return {
    buildingSection: s,
    offsetX: (s.left + s.right) / 2,
    offsetY: front,
    width: s.right - s.left,
    height: front - s.back,
    zBase: base,
    zHeight: Math.max(s.top, s.topRight) - base,
    walkableTop: true,
  };
}

export type Point3 = [number, number, number];
export function sectionCorners(
  s: BuildingSection,
): [Point3, Point3, Point3, Point3, Point3, Point3, Point3, Point3] {
  return [
    [s.left, s.back, s.base],
    [s.right, s.back, s.baseRight],
    [s.right, s.frontRight, s.baseRight],
    [s.left, s.front, s.base],
    [s.left, s.back, s.top],
    [s.right, s.back, s.topRight],
    [s.right, s.frontRight, s.topRight],
    [s.left, s.front, s.top],
  ];
}

export function rectangularSection(s: BuildingSection): boolean {
  return s.front === s.frontRight && s.top === s.topRight && s.base === s.baseRight;
}

export function localFootprint(bounds: AABB, { wx, wy }: { wx: number; wy: number }): AABB {
  return {
    left: bounds.left - wx,
    right: bounds.right - wx,
    top: bounds.top - wy,
    bottom: bounds.bottom - wy,
  };
}

/** Clip in prop-local XY before building the physics section's convex hull.
 * Clamping the corners of a diagonal bay changes its front plane at a chunk seam. */
export function clippedSection(s: BuildingSection, bounds: AABB): Point3[] {
  const left = Math.max(s.left, bounds.left),
    right = Math.min(s.right, bounds.right);
  const back = Math.max(s.back, bounds.top);
  if (!(left < right && back < bounds.bottom)) return [];
  const at = (x: number, a: number, b: number) => a + ((b - a) * (x - s.left)) / (s.right - s.left);
  const front = (x: number) => at(x, s.front, s.frontRight);
  const cuts = [left, right];
  if (s.front !== s.frontRight) {
    for (const y of [back, bounds.bottom]) {
      const x = s.left + ((s.right - s.left) * (y - s.front)) / (s.frontRight - s.front);
      if (x > left && x < right) cuts.push(x);
    }
  }
  if (Math.max(front(left), front(right)) <= back) return [];
  const vertices: Point3[] = [];
  for (const x of cuts) {
    const end = Math.min(bounds.bottom, front(x));
    if (end < back - 1e-8) continue;
    for (const y of [back, Math.max(back, end)])
      for (const z of [at(x, s.base, s.baseRight), at(x, s.top, s.topRight)])
        vertices.push([x, y, z]);
  }
  return vertices;
}

/** Exact occupied interval above the anchor for placement, clearance and roof support. */
export function sectionInterval(s: BuildingSection, box: AABB) {
  if (rectangularSection(s))
    return box.right > s.left && box.left < s.right && box.bottom > s.back && box.top < s.front
      ? { bottom: s.base, top: s.top }
      : undefined;
  const points = clippedSection(s, box);
  if (!points.length) return;
  const zs = points.map((p) => p[2]);
  return { bottom: Math.min(...zs), top: Math.max(...zs) };
}

export function buildingElevation(
  { wx, wy }: { wx: number; wy: number },
  getHeight?: (tx: number, ty: number) => number,
): number {
  return getHeight
    ? getHeight(Math.floor(wx / TILE_SIZE), Math.floor(wy / TILE_SIZE)) * ELEVATION_PX
    : 0;
}

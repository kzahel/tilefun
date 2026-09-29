import type { Point } from "./RegionalPlanner.js";

/** Canonical distance to the orthogonal paths admitted by regional planners. */
export function pathDistance(points: readonly Point[], x: number, y: number): number {
  let distance = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    if (!a || !b) continue;
    const px = Math.max(Math.min(a.x, b.x), Math.min(Math.max(a.x, b.x), x));
    const py = Math.max(Math.min(a.y, b.y), Math.min(Math.max(a.y, b.y), y));
    distance = Math.min(distance, Math.hypot(x - px, y - py));
  }
  return distance;
}

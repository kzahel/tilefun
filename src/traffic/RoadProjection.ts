import type { Path } from "./LaneGraph.js";

/** Project actual solved travel onto a route; route progress never moves a body. */
export function projectRoad(p: Path, x: number, y: number) {
  let distance = Infinity,
    progress = 0,
    heading = 0;
  for (let i = 1; i < p.points.length; i++) {
    const a = p.points[i - 1],
      b = p.points[i];
    if (!a || !b) continue;
    const dx = b.x - a.x,
      dy = b.y - a.y,
      length2 = dx * dx + dy * dy;
    const t = length2 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / length2)) : 0;
    const d = Math.hypot(x - a.x - t * dx, y - a.y - t * dy);
    if (d < distance) {
      distance = d;
      progress = (p.distances[i - 1] ?? 0) + t * Math.sqrt(length2);
      heading = Math.atan2(dy, dx);
    }
  }
  return { distance, progress, heading };
}

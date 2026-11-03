import { type Lane, type Path, path } from "./LaneGraph.js";

/** Tangent-continuous corner with room for the body's physical turning radius.
 * Lane endpoints alone describe road layout, not a feasible vehicle trajectory. */
export function roadTurn(
  from: Lane,
  to: Lane,
  minimumRadius: number,
): { approach: Path; turn: Path } {
  const a = from.path.points.at(-1),
    start = from.path.points[0],
    b = to.path.points[0],
    end = to.path.points.at(-1);
  if (!a || !b || !start || !end) throw Error("Empty road path");
  const lengthA = Math.hypot(a.x - start.x, a.y - start.y),
    lengthB = Math.hypot(end.x - b.x, end.y - b.y);
  const u = { x: (a.x - start.x) / lengthA, y: (a.y - start.y) / lengthA },
    v = { x: (end.x - b.x) / lengthB, y: (end.y - b.y) / lengthB };
  const cross = u.x * v.y - u.y * v.x;
  if (Math.abs(cross) < 0.1) return { approach: from.path, turn: path([a, b]) };
  const distance = ((b.x - a.x) * v.y - (b.y - a.y) * v.x) / cross;
  const intersection = { x: a.x + u.x * distance, y: a.y + u.y * distance };
  const exit = (b.x - intersection.x) * v.x + (b.y - intersection.y) * v.y;
  const radius = Math.max(minimumRadius * 1.25, distance, exit);
  const entry = { x: intersection.x - u.x * radius, y: intersection.y - u.y * radius };
  const finish = { x: intersection.x + v.x * radius, y: intersection.y + v.y * radius };
  const k = 0.55228475 * radius;
  const c1 = { x: entry.x + u.x * k, y: entry.y + u.y * k },
    c2 = { x: finish.x - v.x * k, y: finish.y - v.y * k };
  const points = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24,
      w = 1 - t;
    points.push({
      x: w * w * w * entry.x + 3 * w * w * t * c1.x + 3 * w * t * t * c2.x + t * t * t * finish.x,
      y: w * w * w * entry.y + 3 * w * w * t * c1.y + 3 * w * t * t * c2.y + t * t * t * finish.y,
    });
  }
  return { approach: path([start, entry]), turn: path(points) };
}

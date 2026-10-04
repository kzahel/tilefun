import { required } from "../art/ArtCatalog.js";
import { Direction } from "../entities/Entity.js";
import type { DistrictPlan } from "../generation/regional/DistrictPlanner.js";
import type { Connection, Point } from "../generation/regional/RegionalPlanner.js";

export interface RoadSegment {
  a: Point;
  b: Point;
  width: number;
  intercity: boolean;
}
export interface Lane {
  /** Authored route follows shared terrain/slab support; ordinary generated lanes stay level. */
  surfaceFollowing?: boolean;
  id: string;
  from: string;
  to: string;
  a: Point;
  b: Point;
  direction: Direction;
  width: number;
  intercity: boolean;
  path: Path;
}
export interface Path {
  points: Point[];
  distances: number[];
  length: number;
}
export interface LaneGraph {
  lanes: Map<string, Lane>;
  outgoing: Map<string, Lane[]>;
}
const key = (p: Point) => `${p.x},${p.y}`;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export function path(points: Point[]): Path {
  const distances = [0];
  for (let i = 1; i < points.length; i++)
    distances.push(
      (distances[i - 1] ?? 0) + distance(required(points[i - 1]), required(points[i])),
    );
  return { points, distances, length: distances.at(-1) ?? 0 };
}
export function samplePath(p: Path, d: number): Point & { direction: Direction } {
  d = Math.max(0, Math.min(p.length, d));
  let i = 1;
  while (i < p.points.length - 1 && required(p.distances[i]) < d) i++;
  const a = required(p.points[i - 1]),
    b = required(p.points[i]),
    len = required(p.distances[i]) - required(p.distances[i - 1]);
  const t = len ? (d - required(p.distances[i - 1])) / len : 0;
  const dx = b.x - a.x,
    dy = b.y - a.y;
  return {
    x: a.x + dx * t,
    y: a.y + dy * t,
    direction:
      Math.abs(dx) > Math.abs(dy)
        ? dx > 0
          ? Direction.Right
          : Direction.Left
        : dy > 0
          ? Direction.Down
          : Direction.Up,
  };
}
export function generatedSegments(
  plans: readonly DistrictPlan[],
  connections: readonly Connection[],
): RoadSegment[] {
  const segments: RoadSegment[] = [];
  for (const plan of plans)
    for (const s of plan.streets) {
      const a = required(s.points[0]),
        b = required(s.points[1]);
      // Streets extend to the district boundary in the generated surface contract.
      const horizontal = a.y === b.y;
      segments.push({
        a: { x: horizontal ? plan.bounds.minX : a.x, y: horizontal ? a.y : plan.bounds.minY },
        b: { x: horizontal ? plan.bounds.maxX : b.x, y: horizontal ? b.y : plan.bounds.maxY },
        width: s.width,
        intercity: false,
      });
    }
  for (const c of connections)
    for (let i = 1; i < c.points.length; i++)
      segments.push({
        a: required(c.points[i - 1]),
        b: required(c.points[i]),
        width: 8,
        intercity: true,
      });
  return segments;
}
/** Split semantic orthogonal streets/corridors at crossings and collinear ends.
 * Coordinates supplied in tiles; lanes/path coordinates are world pixels. */
export function buildLaneGraph(segments: readonly RoadSegment[]): LaneGraph {
  const edges = new Map<string, { a: Point; b: Point; width: number; intercity: boolean }>();
  for (const s of segments) {
    const horizontal = s.a.y === s.b.y,
      cuts: Point[] = [s.a, s.b];
    const contains = (p: Point) =>
      p.x >= Math.min(s.a.x, s.b.x) - 0.001 &&
      p.x <= Math.max(s.a.x, s.b.x) + 0.001 &&
      p.y >= Math.min(s.a.y, s.b.y) - 0.001 &&
      p.y <= Math.max(s.a.y, s.b.y) + 0.001;
    for (const t of segments) {
      if (contains(t.a)) cuts.push(t.a);
      if (contains(t.b)) cuts.push(t.b);
      if (horizontal !== (t.a.y === t.b.y)) {
        const p = horizontal ? { x: t.a.x, y: s.a.y } : { x: s.a.x, y: t.a.y };
        if (
          contains(p) &&
          p.x >= Math.min(t.a.x, t.b.x) &&
          p.x <= Math.max(t.a.x, t.b.x) &&
          p.y >= Math.min(t.a.y, t.b.y) &&
          p.y <= Math.max(t.a.y, t.b.y)
        )
          cuts.push(p);
      }
    }
    const sorted = [...new Map(cuts.map((p) => [key(p), p])).values()].sort((a, b) =>
      horizontal ? a.x - b.x : a.y - b.y,
    );
    for (let i = 1; i < sorted.length; i++) {
      const a = required(sorted[i - 1]),
        b = required(sorted[i]);
      if (distance(a, b) < 1) continue;
      const id = `${key(a)}:${key(b)}`,
        old = edges.get(id);
      edges.set(id, {
        a,
        b,
        width: Math.max(s.width, old?.width ?? 0),
        intercity: s.intercity && (old?.intercity ?? true),
      });
    }
  }
  // Semantic corridor ends often sit a few tiles before a city boundary.
  // Collapse degree-two collinear seams so they are not tiny fake junctions.
  let merged = true;
  while (merged) {
    merged = false;
    const touching = new Map<string, string[]>();
    for (const [id, e] of edges)
      for (const p of [e.a, e.b]) {
        const ids = touching.get(key(p)) ?? [];
        ids.push(id);
        touching.set(key(p), ids);
      }
    for (const [node, ids] of touching) {
      if (ids.length !== 2) continue;
      const first = required(edges.get(required(ids[0]))),
        second = required(edges.get(required(ids[1])));
      const a = key(first.a) === node ? first.b : first.a,
        b = key(second.a) === node ? second.b : second.a;
      if (a.x !== b.x && a.y !== b.y) continue;
      edges.delete(required(ids[0]));
      edges.delete(required(ids[1]));
      edges.set(`${key(a)}:${key(b)}`, {
        a,
        b,
        width: Math.min(first.width, second.width),
        intercity: first.intercity || second.intercity,
      });
      merged = true;
      break;
    }
  }
  const lanes = new Map<string, Lane>(),
    outgoing = new Map<string, Lane[]>();
  for (const e of edges.values())
    for (const [start, end] of [
      [e.a, e.b],
      [e.b, e.a],
    ] as const) {
      const a = { x: start.x * 16, y: start.y * 16 },
        b = { x: end.x * 16, y: end.y * 16 };
      const len = distance(a, b),
        dx = (b.x - a.x) / len,
        dy = (b.y - a.y) / len;
      const offset = e.width * 4,
        inset = Math.min(e.width * 8, len / 3);
      const p = path([
        { x: a.x + dx * inset - dy * offset, y: a.y + dy * inset + dx * offset },
        { x: b.x - dx * inset - dy * offset, y: b.y - dy * inset + dx * offset },
      ]);
      const id = `${key(start)}>${key(end)}`;
      const lane: Lane = {
        id,
        from: key(start),
        to: key(end),
        a,
        b,
        width: e.width * 16,
        intercity: e.intercity,
        path: p,
        direction: samplePath(p, 0).direction,
      };
      lanes.set(id, lane);
      const list = outgoing.get(lane.from) ?? [];
      list.push(lane);
      outgoing.set(lane.from, list);
    }
  for (const lanes of outgoing.values()) lanes.sort((a, b) => a.id.localeCompare(b.id));
  return { lanes, outgoing };
}
export function turnPath(from: Lane, to: Lane): Path {
  const a = required(from.path.points.at(-1)),
    b = required(to.path.points[0]);
  const control =
    from.direction === to.direction ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : from.b;
  const points: Point[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24,
      u = 1 - t;
    points.push({
      x: u * u * a.x + 2 * u * t * control.x + t * t * b.x,
      y: u * u * a.y + 2 * u * t * control.y + t * t * b.y,
    });
  }
  return path(points);
}
export function nextLanes(graph: LaneGraph, lane: Lane, minimumWidth = 0): Lane[] {
  return (graph.outgoing.get(lane.to) ?? []).filter(
    (l) => l.to !== lane.from && l.width >= minimumWidth && l.path.length > 0,
  );
}

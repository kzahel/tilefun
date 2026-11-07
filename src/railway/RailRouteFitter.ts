import { pathDistance } from "../generation/regional/PlanGeometry.js";
import {
  type Bounds,
  type Connection,
  connectionForOwner,
  intersects,
  type Point,
  plannedElevation,
  type Settlement,
  settlementForOwner,
} from "../generation/regional/RegionalPlanner.js";
import type { RegionalWorld } from "../generation/regional/WorldDescriptor.js";
import { required } from "../shared/required.js";
import { RailAlignment, type RailPath, type RailPose, type RailSegment } from "./RailPath.js";
import { BRIDGE_REACH_TILES, type RailBridge } from "./RoadRailBridge.js";

/** Station band, tiles south of a town center (clear of the street grid at +44). */
export const STATION_BAND = 60;
/** Each town has a west-facing and an east-facing platform this far from its center. */
export const STATION_SLOT = 32;
/** Track tiles between a stop and its buffer end, toward the town center. */
export const STATION_APPROACH = 16;
/** Minimum road distance from track anywhere outside an admitted bridge crossing. */
const ROAD_CLEARANCE = 15;
/** Road straight beyond the rail on each side of a crossing: ramps plus a short run-out. */
const BRIDGE_ROAD_MARGIN = BRIDGE_REACH_TILES + 8;
/** Unrelated roads keep this distance from a bridge's carried-road centerline. */
const BRIDGE_SIDE_CLEARANCE = 14;
/** Track stays on a perpendicular straight for this far either side of a deck. */
const DECK_STRAIGHT = 8;
const RADII = [512, 768] as const;
const FRACTIONS = [0.5, 0.35, 0.65, 0.25, 0.75] as const;
/** First bend starts at least this far (px) beyond a stop. */
const STATION_RUN = 32 * 16;

/** Conservative district footprint: street grid, northern shopping and margin. */
export function townCore(town: Settlement): Bounds {
  const { x, y } = town.center;
  return town.kind === "city"
    ? { minX: x - 144, maxX: x + 144, minY: y - 192, maxY: y + 50 }
    : { minX: x - 56, maxX: x + 56, minY: y - 56, maxY: y + 50 };
}
const grow = (b: Bounds, r: number): Bounds => ({
  minX: b.minX - r,
  minY: b.minY - r,
  maxX: b.maxX + r,
  maxY: b.maxY + r,
});
const inside = (b: Bounds, x: number, y: number) =>
  x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY;

function hash(a: number, b: number, seed: number): number {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ seed ^ 0x5f3759df;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 2 ** 32;
}

/** Horizontal approaches joined by one tangent S-bend. Its middle is a vertical
 * straight when the offset exceeds two radii. The bend center is tile-aligned. */
function sCurve(
  x0: number,
  ya: number,
  x1: number,
  yb: number,
  radius: number,
  fraction: number,
): RailSegment[] | undefined {
  const delta = yb - ya;
  if (delta === 0) return [{ kind: "line", x: x0, y: ya, endX: x1, endY: ya }];
  const sign = Math.sign(delta),
    angle =
      Math.abs(delta) >= 2 * radius ? Math.PI / 2 : Math.acos(1 - Math.abs(delta) / (2 * radius));
  const width = 2 * radius * Math.sin(angle),
    mid = Math.round((x0 + (x1 - x0) * fraction) / 16) * 16,
    pivot = mid - width / 2,
    end = mid + width / 2;
  if (pivot < x0 + STATION_APPROACH * 16 + STATION_RUN) return;
  if (end > x1 - STATION_APPROACH * 16 - STATION_RUN) return;
  const segments: RailSegment[] = [
    { kind: "line", x: x0, y: ya, endX: pivot, endY: ya },
    {
      kind: "arc",
      x: pivot,
      y: ya + sign * radius,
      radius,
      angle: (-sign * Math.PI) / 2,
      sweep: sign * angle,
    },
  ];
  const y1 = ya + sign * radius * (1 - Math.cos(angle)),
    y2 = yb - sign * radius * (1 - Math.cos(angle));
  if (Math.abs(y2 - y1) > 0.001)
    segments.push({ kind: "line", x: mid, y: y1, endX: mid, endY: y2 });
  segments.push(
    {
      kind: "arc",
      x: end,
      y: yb - sign * radius,
      radius,
      angle: sign * (Math.PI / 2 + angle),
      sweep: -sign * angle,
    },
    { kind: "line", x: end, y: yb, endX: x1, endY: yb },
  );
  return segments;
}

interface Context {
  world: RegionalWorld;
  id: string;
  towns: Settlement[];
  roads: Connection[];
  elevation: (x: number, y: number) => number;
}
const dry = (ctx: Context, b: Bounds) => {
  for (let ty = b.minY; ty <= b.maxY; ty += 2)
    for (let tx = b.minX; tx <= b.maxX; tx += 2) if (ctx.elevation(tx, ty) < 0.06) return false;
  return true;
};

type Segment = readonly [Point, Point];

/** Track samples within road clearance of one straight road segment. */
function nearSamples(samples: readonly RailPose[], [p, q]: Segment): RailPose[] {
  const r = ROAD_CLEARANCE,
    minX = Math.min(p.x, q.x) - r,
    maxX = Math.max(p.x, q.x) + r,
    minY = Math.min(p.y, q.y) - r,
    maxY = Math.max(p.y, q.y) + r;
  return samples.filter((s) => {
    const x = s.x / 16,
      y = s.y / 16;
    return inside({ minX, minY, maxX, maxY }, x, y) && pathDistance([p, q], x, y) <= r;
  });
}

/** Straight track perpendicular to the road segment, extending past its deck. */
function crossingTrack(segments: readonly RailSegment[], vertical: boolean, along: number) {
  const lo = along - DECK_STRAIGHT * 16,
    hi = along + DECK_STRAIGHT * 16;
  for (const s of segments) {
    if (s.kind !== "line" || (vertical ? s.y !== s.endY : s.x !== s.endX)) continue;
    const a = vertical ? s.x : s.y,
      b = vertical ? s.endX : s.endY;
    if (Math.min(a, b) <= lo && Math.max(a, b) >= hi) return s;
  }
  return undefined;
}

/** The single admissible bridge for a road segment the track approaches, if any. */
function bridgeFor(
  id: string,
  road: Connection,
  [p, q]: Segment,
  near: readonly RailPose[],
  segments: readonly RailSegment[],
): RailBridge | undefined {
  // North/south roads cross horizontal track; east/west roads the vertical straight.
  const vertical = p.x === q.x;
  const rail = crossingTrack(segments, vertical, (vertical ? p.x : p.y) * 16);
  if (!rail) return undefined;
  const x = vertical ? p.x : rail.x / 16,
    y = vertical ? rail.y / 16 : p.y;
  const across = vertical ? y : x,
    first = vertical ? Math.min(p.y, q.y) : Math.min(p.x, q.x),
    last = vertical ? Math.max(p.y, q.y) : Math.max(p.x, q.x);
  if (!Number.isInteger(across)) return undefined;
  if (across < first + BRIDGE_ROAD_MARGIN || across > last - BRIDGE_ROAD_MARGIN) return undefined;
  if (near.some((s) => Math.hypot(s.x / 16 - x, s.y / 16 - y) > ROAD_CLEARANCE * 1.5))
    return undefined;
  const axis = vertical ? "south" : "east",
    reach = BRIDGE_REACH_TILES;
  return {
    id: `${id}:bridge:${axis}:${x}:${y}`,
    roadId: road.id,
    axis,
    x,
    y,
    bounds: vertical
      ? { minX: x - 6, maxX: x + 6, minY: y - reach, maxY: y + reach }
      : { minX: x - reach, maxX: x + reach, minY: y - 6, maxY: y + 6 },
  };
}

function* roadSegments(road: Connection): Generator<Segment> {
  for (let i = 1; i < road.points.length; i++)
    yield [required(road.points[i - 1]), required(road.points[i])];
}

/** Another corridor sharing the carried road's alignment is the same road. */
const collinear = (b: RailBridge, [p, q]: Segment) =>
  b.axis === "south" ? p.x === q.x && p.x === b.x : p.y === q.y && p.y === b.y;

/** Whether a road segment comes near the carried road's ramps and deck. */
function nearCarriedRoad(b: RailBridge, segment: Segment): boolean {
  const south = b.axis === "south";
  for (let t = -BRIDGE_REACH_TILES; t <= BRIDGE_REACH_TILES; t += 2) {
    const x = south ? b.x : b.x + t,
      y = south ? b.y + t : b.y;
    if (pathDistance(segment, x, y) <= BRIDGE_SIDE_CLEARANCE) return true;
  }
  return false;
}

/** No unrelated road comes near the carried road's ramps and deck. */
const footprintClear = (ctx: Context, bridge: RailBridge) =>
  ctx.roads.every(
    (road) =>
      road.id === bridge.roadId ||
      [...roadSegments(road)].every((s) => collinear(bridge, s) || !nearCarriedRoad(bridge, s)),
  );

function bridgeSiteOk(ctx: Context, bridge: RailBridge, all: readonly RailBridge[]): boolean {
  if (!dry(ctx, bridge.bounds)) return false;
  if (ctx.towns.some((t) => intersects(grow(townCore(t), 4), bridge.bounds))) return false;
  if (all.some((o) => o !== bridge && intersects(grow(o.bounds, 8), bridge.bounds))) return false;
  return footprintClear(ctx, bridge);
}

/** Every road approach must be one perpendicular crossing of a straight road over
 * a straight piece of track; those become bridges. Anything else rejects. */
function crossings(
  ctx: Context,
  samples: readonly RailPose[],
  segments: readonly RailSegment[],
): RailBridge[] | undefined {
  const found = new Map<string, RailBridge>();
  for (const road of ctx.roads)
    for (const segment of roadSegments(road)) {
      const near = nearSamples(samples, segment);
      if (!near.length) continue;
      const bridge = bridgeFor(ctx.id, road, segment, near, segments);
      if (!bridge) return undefined;
      if (!found.has(bridge.id)) found.set(bridge.id, bridge);
    }
  const bridges = [...found.values()];
  return bridges.every((b) => bridgeSiteOk(ctx, b, bridges)) ? bridges : undefined;
}

export interface FittedRoute {
  path: RailPath;
  bridges: RailBridge[];
}

function routeContext(world: RegionalWorld, id: string, a: Settlement, b: Settlement): Context {
  const towns: Settlement[] = [],
    roads = new Map<string, Connection>();
  for (let cy = a.owner.cy - 1; cy <= a.owner.cy + 1; cy++)
    for (let cx = a.owner.cx - 1; cx <= b.owner.cx + 1; cx++) {
      const town = settlementForOwner(world, cx, cy);
      if (town) towns.push(town);
      for (const axis of ["east", "south"] as const) {
        const road = connectionForOwner(world, cx, cy, axis);
        if (road) roads.set(road.id, road);
      }
    }
  const elevation = (x: number, y: number) => plannedElevation(world, x, y);
  return { world, id, towns, roads: [...roads.values()], elevation };
}

/** Stops sit STATION_APPROACH tiles inside each end; invalid geometry yields undefined. */
function candidatePath(segments: RailSegment[], a: Settlement, b: Settlement) {
  const length = segments.reduce(
    (n, s) =>
      n +
      (s.kind === "line" ? Math.hypot(s.endX - s.x, s.endY - s.y) : s.radius * Math.abs(s.sweep)),
    0,
  );
  const path: RailPath = {
    segments,
    closed: false,
    stops: [
      { distance: STATION_APPROACH * 16, name: a.name },
      { distance: length - STATION_APPROACH * 16, name: b.name },
    ],
  };
  try {
    return { path, samples: new RailAlignment(path).samples(16) };
  } catch {
    return undefined;
  }
}

/** Clear of every town core (endpoints included) and dry across the corridor. */
function corridorOk(ctx: Context, samples: readonly RailPose[]): boolean {
  const cores = ctx.towns.map((t) => grow(townCore(t), 8));
  if (samples.some((s) => cores.some((c) => inside(c, s.x / 16, s.y / 16)))) return false;
  return !samples.some(
    (s, i) =>
      i % 2 === 0 &&
      [-8, 0, 8].some((ox) =>
        [-8, 0, 8].some((oy) => ctx.elevation(s.x / 16 + ox, s.y / 16 + oy) < 0.06),
      ),
  );
}

/** Fit track from `a`'s east platform to `b`'s west platform. Candidates (radius,
 * bend position) are tried in a seeded order so neighbouring routes vary. */
export function fitRoute(
  world: RegionalWorld,
  id: string,
  a: Settlement,
  b: Settlement,
): FittedRoute | undefined {
  const x0 = (a.center.x + STATION_SLOT - STATION_APPROACH) * 16,
    x1 = (b.center.x - STATION_SLOT + STATION_APPROACH) * 16,
    ya = (a.center.y + STATION_BAND) * 16,
    yb = (b.center.y + STATION_BAND) * 16;
  const ctx = routeContext(world, id, a, b);
  const radii = hash(a.owner.cx, a.owner.cy, world.seed) < 0.5 ? RADII : [...RADII].reverse();
  for (const radius of radii)
    for (const fraction of FRACTIONS) {
      const segments = sCurve(x0, ya, x1, yb, radius, fraction);
      const candidate = segments && candidatePath(segments, a, b);
      if (!segments || !candidate || !corridorOk(ctx, candidate.samples)) continue;
      const bridges = crossings(ctx, candidate.samples, segments);
      if (bridges) return { path: candidate.path, bridges };
    }
  return undefined;
}

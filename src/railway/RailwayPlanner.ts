import {
  type Bounds,
  intersects,
  plannedElevation,
  REGION_SIZE,
  type Settlement,
  settlementForOwner,
} from "../generation/regional/RegionalPlanner.js";
import type { RegionalWorld } from "../generation/regional/WorldDescriptor.js";
import type { RailPath } from "./RailPath.js";
import { railAlignment } from "./RailPath.js";
import { fitRoute, STATION_BAND, STATION_SLOT } from "./RailRouteFitter.js";
import type { RailBridge } from "./RoadRailBridge.js";

export interface RailStation {
  id: string;
  town: Settlement;
  x: number;
  y: number;
  /** Platform plus the paved concourse back to the town access path. */
  platform: Bounds;
  access: Bounds;
}
export interface RailLine {
  path: RailPath;
  id: string;
  bounds: Bounds;
  /** First station's track row, tiles. */
  y: number;
  /** Town centers, tiles. */
  start: number;
  end: number;
  stations: [RailStation, RailStation];
  bridges: RailBridge[];
}

const SHARED_LINES = new Map<string, RailLine | null>();

/** `side` 1 is the town's east-facing platform; -1 its west-facing one. */
function station(lineId: string, town: Settlement, side: 1 | -1): RailStation {
  const { x: cx, y: cy } = town.center,
    x = cx + side * STATION_SLOT,
    y = cy + STATION_BAND;
  return {
    id: `${lineId}:${town.id}`,
    town,
    x,
    y,
    platform:
      side > 0
        ? { minX: cx - 2, maxX: x + 18, minY: y - 6, maxY: y - 2 }
        : { minX: x - 18, maxX: cx + 2, minY: y - 6, maxY: y - 2 },
    access: { minX: cx - 2, maxX: cx + 2, minY: cy + 44, maxY: y - 2 },
  };
}

/** One single-track link per east-neighbour town pair, owned by the western
 * town's region. Hub towns use separate east/west platforms either side of their
 * southern access, so links never share track. Road crossings become bridges. */
export class RailwayPlanner {
  constructor(readonly world: RegionalWorld) {}
  /** Lines are pure functions of seed and owner. Every generation planner makes its
   * own RailwayPlanner, so one bounded module cache avoids refitting the same link.
   * Returned lines are shared and must be treated as immutable. */
  owner(cx: number, cy: number): RailLine | null {
    const key = `${this.world.seed}:${this.world.generatorVersion}:${cx},${cy}`;
    const cached = SHARED_LINES.get(key);
    if (cached !== undefined) {
      // Refresh recency so hot links survive eviction.
      SHARED_LINES.delete(key);
      SHARED_LINES.set(key, cached);
      return cached;
    }
    const result = this.plan(cx, cy);
    SHARED_LINES.set(key, result);
    if (SHARED_LINES.size > 512) SHARED_LINES.delete(SHARED_LINES.keys().next().value ?? "");
    return result;
  }
  private plan(cx: number, cy: number): RailLine | null {
    const a = settlementForOwner(this.world, cx, cy),
      b = settlementForOwner(this.world, cx + 1, cy);
    if (!a || !b) return null;
    const id = `rail:${cx}:${cy}`;
    const stations: [RailStation, RailStation] = [station(id, a, 1), station(id, b, -1)];
    const dry = (b: Bounds) => {
      for (let ty = b.minY; ty <= b.maxY; ty += 2)
        for (let tx = b.minX; tx <= b.maxX; tx += 4)
          if (plannedElevation(this.world, tx, ty) < 0.06) return false;
      return true;
    };
    if (stations.some((s) => !dry(s.platform) || !dry(s.access))) return null;
    const route = fitRoute(this.world, id, a, b);
    if (!route) return null;
    const box = railAlignment(route.path).bounds;
    return {
      id,
      path: route.path,
      bounds: {
        minX: box.minX / 16,
        minY: box.minY / 16,
        maxX: box.maxX / 16,
        maxY: box.maxY / 16,
      },
      y: stations[0].y,
      start: a.center.x,
      end: b.center.x,
      stations,
      bridges: route.bridges,
    };
  }
  query(bounds: Bounds): RailLine[] {
    const query = this.querySteps(bounds);
    let step = query.next();
    while (!step.done) step = query.next();
    return step.value;
  }
  /** One owner per cooperative step; overview workers can cancel between plans. */
  *querySteps(bounds: Bounds, maxOwners = 144): Generator<void, RailLine[]> {
    const result: RailLine[] = [];
    // A link, its stations and bridges stay inside its two owners' row.
    const minX = Math.floor(bounds.minX / REGION_SIZE) - 1,
      maxX = Math.floor(bounds.maxX / REGION_SIZE);
    const minY = Math.floor(bounds.minY / REGION_SIZE),
      maxY = Math.floor(bounds.maxY / REGION_SIZE);
    if ((maxX - minX + 1) * (maxY - minY + 1) > maxOwners) return result;
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const line = this.owner(x, y);
        if (
          line &&
          (intersects(bounds, line.bounds) ||
            line.bridges.some((b) => intersects(bounds, b.bounds)) ||
            line.stations.some(
              (s) => intersects(bounds, s.platform) || intersects(bounds, s.access),
            ))
        )
          result.push(line);
        yield;
      }
    return result;
  }
  /** First (western town's east-facing) platform of the nearest admitted link to the origin; `accept` narrows the choice. */
  start(
    accept: (line: RailLine, cx: number, cy: number) => boolean = () => true,
  ): { x: number; y: number } | undefined {
    const owners = [];
    for (let cy = -8; cy <= 8; cy++) for (let cx = -8; cx <= 8; cx++) owners.push({ cx, cy });
    owners.sort(
      (a, b) => Math.hypot(a.cx, a.cy) - Math.hypot(b.cx, b.cy) || a.cy - b.cy || a.cx - b.cx,
    );
    for (const o of owners) {
      const line = this.owner(o.cx, o.cy);
      if (line && accept(line, o.cx, o.cy))
        return { x: line.stations[0].x, y: line.stations[0].y - 3 };
    }
    return undefined;
  }
}

/** One station per town for stop lists: hub towns have an east and a west platform. */
export function townStops(lines: readonly RailLine[]): RailStation[] {
  const stops = new Map<string, RailStation>();
  for (const s of lines.flatMap((l) => l.stations))
    if (!stops.has(s.town.id)) stops.set(s.town.id, s);
  return [...stops.values()];
}

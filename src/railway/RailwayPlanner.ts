import { required } from "../art/ArtCatalog.js";
import { pathDistance } from "../generation/regional/PlanGeometry.js";
import {
  type Bounds,
  connectionForOwner,
  intersects,
  plannedElevation,
  REGION_SIZE,
  type Settlement,
  settlementForOwner,
} from "../generation/regional/RegionalPlanner.js";
import type { RegionalWorld } from "../generation/regional/WorldDescriptor.js";
import { curvedCityLine } from "./CurvedRailPlanner.js";
import type { RailPath } from "./RailPath.js";
import type { RailBridge } from "./RoadRailBridge.js";

export interface RailStation {
  id: string;
  town: Settlement;
  x: number;
  y: number;
  platform: Bounds;
  access: Bounds;
}
export interface RailLine {
  path?: RailPath;
  id: string;
  bounds: Bounds;
  y: number;
  start: number;
  end: number;
  stations: [RailStation, RailStation];
  bridges: RailBridge[];
}
/** Non-overlapping east/west owner pairs. All distances are tiles. No unsupported crossings. */
export class RailwayPlanner {
  private cache = new Map<string, RailLine | null>();
  constructor(readonly world: RegionalWorld) {}
  owner(cx: number, cy: number): RailLine | null {
    cx = Math.floor(cx / 2) * 2;
    const key = `${cx},${cy}`;
    if (this.cache.has(key)) return this.cache.get(key) ?? null;
    const straight = this.plan(cx, cy);
    const result = straight ? (curvedCityLine(this.world, straight) ?? straight) : null;
    this.cache.set(key, result);
    if (this.cache.size > 128) this.cache.delete(this.cache.keys().next().value ?? "");
    return result;
  }
  private plan(cx: number, cy: number): RailLine | null {
    const a = settlementForOwner(this.world, cx, cy),
      b = settlementForOwner(this.world, cx + 1, cy);
    if (!a || !b || Math.abs(a.center.y - b.center.y) > 256) return null;
    const y = Math.max(a.center.y, b.center.y) + 60;
    const id = `rail:${cx}:${cy}`;
    const stations = [a, b].map(
      (town): RailStation => ({
        id: `${id}:${town.id}`,
        town,
        x: town.center.x,
        y,
        platform: { minX: town.center.x - 18, maxX: town.center.x + 18, minY: y - 6, maxY: y - 2 },
        access: {
          minX: town.center.x - 2,
          maxX: town.center.x + 2,
          minY: town.center.y + 44,
          maxY: y - 2,
        },
      }),
    ) as [RailStation, RailStation];
    const bounds = { minX: a.center.x - 20, maxX: b.center.x + 20, minY: y - 2, maxY: y + 2 };
    // Dry rail/station admission is unchanged; at most one isolated straight road crossing.
    const dry = (b: Bounds) => {
      for (let ty = b.minY; ty <= b.maxY; ty += 2)
        for (let tx = b.minX; tx <= b.maxX; tx += 4)
          if (plannedElevation(this.world, tx, ty) < 0.06) return false;
      return true;
    };
    if (!dry(bounds) || stations.some((s) => !dry(s.platform) || !dry(s.access))) return null;
    const bridges: RailBridge[] = [];
    for (let sy = cy - 1; sy <= cy + 1; sy++)
      for (let sx = cx - 1; sx <= cx + 2; sx++)
        for (const axis of ["east", "south"] as const) {
          const road = connectionForOwner(this.world, sx, sy, axis);
          if (!road) continue;
          const conflicts = [];
          for (let x = bounds.minX; x <= bounds.maxX; x += 4)
            if (pathDistance(road.points, x, y) <= 10) conflicts.push(x);
          if (!conflicts.length) continue;
          const crossing = road.points
            .slice(1)
            .map((p, i) => ({ a: required(road.points[i]), b: p }))
            .find(
              ({ a: p, b: q }) =>
                p.x === q.x &&
                p.x > a.center.x + 40 &&
                p.x < b.center.x - 40 &&
                Math.min(p.y, q.y) <= y - 36 &&
                Math.max(p.y, q.y) >= y + 36,
            );
          if (!crossing || bridges.length || conflicts.some((x) => Math.abs(x - crossing.a.x) > 10))
            return null;
          const x = crossing.a.x;
          const bridgeBounds = { minX: x - 6, maxX: x + 6, minY: y - 28, maxY: y + 28 };
          if (!dry(bridgeBounds)) return null;
          bridges.push({
            id: `${id}:bridge:${road.id}`,
            roadId: road.id,
            x,
            y,
            bounds: bridgeBounds,
          });
        }
    // No other road, town block or station may intrude into an approach reservation.
    for (const bridge of bridges) {
      for (let sy = cy - 1; sy <= cy + 1; sy++)
        for (let sx = cx - 1; sx <= cx + 2; sx++) {
          const town = settlementForOwner(this.world, sx, sy);
          if (town && Math.abs(town.center.x - bridge.x) < 54 && Math.abs(town.center.y - y) < 68)
            return null;
          for (const axis of ["east", "south"] as const) {
            const road = connectionForOwner(this.world, sx, sy, axis);
            if (!road || road.id === bridge.roadId) continue;
            for (let ty = y - 24; ty <= y + 24; ty += 2)
              if (pathDistance(road.points, bridge.x, ty) <= 14) return null;
          }
        }
    }
    return { id, bounds, y, start: a.center.x, end: b.center.x, stations, bridges };
  }
  query(bounds: Bounds): RailLine[] {
    const result: RailLine[] = [];
    // Station access and corridor fit inside their two owner cells.
    const minX = Math.floor(bounds.minX / REGION_SIZE / 2) * 2,
      maxX = Math.floor(bounds.maxX / REGION_SIZE / 2) * 2;
    const minY = Math.floor(bounds.minY / REGION_SIZE),
      maxY = Math.floor(bounds.maxY / REGION_SIZE);
    if (((maxX - minX + 2) / 2) * (maxY - minY + 1) > 144) return result;
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x += 2) {
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
      }
    return result;
  }
  start(): { x: number; y: number } | undefined {
    const owners = [];
    for (let cy = -8; cy <= 8; cy++) for (let cx = -8; cx <= 8; cx += 2) owners.push({ cx, cy });
    owners.sort(
      (a, b) => Math.hypot(a.cx, a.cy) - Math.hypot(b.cx, b.cy) || a.cy - b.cy || a.cx - b.cx,
    );
    for (const o of owners) {
      const line = this.owner(o.cx, o.cy);
      if (line) return { x: line.stations[0].x, y: line.stations[0].y - 3 };
    }
    return undefined;
  }
}

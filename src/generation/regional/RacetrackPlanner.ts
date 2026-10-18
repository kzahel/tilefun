import { nearestRail } from "../../railway/RailPath.js";
import { RailwayPlanner } from "../../railway/RailwayPlanner.js";
import { RoadType } from "../../road/RoadType.js";
import type { ActorPlacement } from "../Generator.js";
import { DenseDistrictSource, insideDenseBounds } from "./DenseDistrictPlanner.js";
import type { FeaturePlacement } from "./DistrictStrategy.js";
import { pathDistance } from "./PlanGeometry.js";
import {
  type Bounds,
  intersects,
  type Point,
  QUERY_LIMITS,
  queryRegion,
  REGION_SIZE,
  settlementForOwner,
} from "./RegionalPlanner.js";
import type { RegionalWorld } from "./WorldDescriptor.js";

export interface Racetrack {
  id: string;
  name: string;
  center: Point;
  bounds: Bounds;
  access: Point[];
  props: FeaturePlacement[];
  actors: ActorPlacement[];
}

/** Stadium oval: 48-tile straights and broad round ends. */
export function racetrackRadius(track: Racetrack, x: number, y: number): number {
  return Math.hypot(Math.max(0, Math.abs(x - track.center.x) - 24), y - track.center.y);
}

export function racetrackReserved(track: Racetrack, x: number, y: number, r = 0): boolean {
  return (
    insideDenseBounds(
      {
        minX: track.bounds.minX - r,
        minY: track.bounds.minY - r,
        maxX: track.bounds.maxX + r,
        maxY: track.bounds.maxY + r,
      },
      x,
      y,
    ) || pathDistance(track.access, x, y) <= 5 + r
  );
}

/** Saved ordinary road cells, including kerbs and a two-tile checkered finish line. */
export function racetrackSurface(track: Racetrack, x: number, y: number): number {
  const radius = racetrackRadius(track, x + 0.5, y + 0.5);
  if (radius >= 20 && radius < 36) {
    if (radius < 21 || radius >= 35)
      return (Math.floor((x - track.center.x) / 2) + Math.floor((y - track.center.y) / 2)) % 2
        ? RoadType.RaceCurbRed
        : RoadType.RaceCurbWhite;
    if (x >= track.center.x && x < track.center.x + 2 && y < track.center.y)
      return RoadType.RaceStart;
    if (Math.abs(radius - 28) < 0.4 && (Math.floor(x / 3) + Math.floor(y / 3)) % 2 === 0)
      return RoadType.RaceLane;
    return RoadType.Asphalt;
  }
  const plaza =
    Math.abs(x + 0.5 - track.center.x) <= 27 && y >= track.center.y + 39 && y < track.center.y + 49;
  if (plaza) return RoadType.CityPavement;
  const access = pathDistance(track.access, x + 0.5, y + 0.5);
  return access <= 3 ? RoadType.Asphalt : access <= 5 ? RoadType.CityPavement : RoadType.None;
}

/** Independent city-owned reservations; no wildlife or rural planner dependencies. */
export class RacetrackSource {
  private cache = new Map<string, Racetrack | null>();
  private districts: DenseDistrictSource;
  private railways: RailwayPlanner;
  constructor(readonly world: RegionalWorld) {
    this.districts = new DenseDistrictSource(world, true);
    this.railways = new RailwayPlanner(world);
  }
  owner(cx: number, cy: number): Racetrack | null {
    const key = `${cx},${cy}`;
    if (this.cache.has(key)) return this.cache.get(key) ?? null;
    const result = this.plan(cx, cy);
    this.cache.set(key, result);
    if (this.cache.size > 64) this.cache.delete(this.cache.keys().next().value ?? "");
    return result;
  }
  private plan(cx: number, cy: number): Racetrack | null {
    const city = this.districts.owner(cx, cy);
    const settlement = settlementForOwner(this.world, cx, cy);
    if (!city || settlement?.kind !== "city") return null; // Villages keep their rural scale.
    const grid = city.gridBounds ?? city.bounds;
    for (const side of [1, -1]) {
      const x = (side > 0 ? grid.maxX : grid.minX) + side * 70,
        y = city.center.y - 64;
      const bounds = { minX: x - 64, minY: y - 52, maxX: x + 64, maxY: y + 52 };
      const access = [
        { x: side > 0 ? grid.maxX - 4 : grid.minX + 4, y: city.center.y },
        { x, y: city.center.y },
        { x, y: y + 46 },
      ];
      const reservation = { ...bounds, maxY: city.center.y + 6 };
      const region = queryRegion(this.world, {
        bounds: reservation,
        detail: "region",
        sampleStep: 128,
        limits: QUERY_LIMITS,
      });
      const lines = this.railways.query(reservation);
      // Keep the entire venue away from existing intercity roads and railways.
      // Its short access road may share the city's existing outbound road.
      let valid = true;
      for (let py = bounds.minY; py <= bounds.maxY && valid; py += 4)
        for (let px = bounds.minX; px <= bounds.maxX; px += 4)
          if (
            region.connections.some((c) => pathDistance(c.points, px, py) < 12) ||
            lines.some((l) =>
              l.path
                ? nearestRail(l.path, px * 16, py * 16).distance < 12 * 16
                : px >= l.start - 12 && px <= l.end + 12 && Math.abs(py - l.y) < 12,
            )
          ) {
            valid = false;
            break;
          }
      if (!valid) continue;
      const id = `${city.id}:racetrack`,
        props: FeaturePlacement[] = [],
        actors: ActorPlacement[] = [];
      const add = (suffix: string, propType: string, dx: number, dy: number) =>
        props.push({
          featureId: `${id}:${suffix}`,
          propType,
          wx: (x + dx) * 16,
          wy: (y + dy) * 16,
        });
      for (let row = 0; row < 3; row++)
        for (let col = 0; col < 8; col++) {
          const dx = -23 + col * 6,
            dy = 41 + row * 3;
          add(`bench:${row}:${col}`, "prop-bench", dx, dy);
          actors.push({
            featureId: `${id}:spectator:${row}:${col}`,
            type: `person${1 + ((row * 8 + col) % 20)}`,
            wx: (x + dx + 1.8) * 16,
            wy: (y + dy - 0.5) * 16,
            route: [
              { wx: (x + dx + 1.8) * 16, wy: (y + dy - 0.5) * 16, waitSeconds: 20 },
              { wx: (x + dx + 1.8) * 16, wy: (y + dy + 0.5) * 16, waitSeconds: 20 },
            ],
          });
        }
      for (const dx of [-28, 28]) {
        add(`lamp:${dx}`, "prop-street-lamp", dx, 40);
        add(`bin:${dx}`, "prop-city-street-v1-bin-black", dx, 47);
        add(`umbrella:${dx}`, "prop-beach-umbrella", dx, -42);
      }
      add("picnic:left", "prop-picnic-table", -12, -43);
      add("picnic:right", "prop-picnic-table", 12, -43);
      return {
        id,
        name: `${settlement.name} Speedway`,
        center: { x, y },
        bounds,
        access,
        props,
        actors,
      };
    }
    return null;
  }
  query(bounds: Bounds): Racetrack[] {
    const result: Racetrack[] = [];
    if (
      (Math.floor((bounds.maxX - bounds.minX) / REGION_SIZE) + 4) *
        (Math.floor((bounds.maxY - bounds.minY) / REGION_SIZE) + 4) >
      144
    )
      return result;
    for (
      let cy = Math.floor(bounds.minY / REGION_SIZE) - 1;
      cy <= Math.floor(bounds.maxY / REGION_SIZE) + 1;
      cy++
    )
      for (
        let cx = Math.floor(bounds.minX / REGION_SIZE) - 1;
        cx <= Math.floor(bounds.maxX / REGION_SIZE) + 1;
        cx++
      ) {
        const track = this.owner(cx, cy);
        if (
          track &&
          (intersects(track.bounds, bounds) ||
            track.access.some((p, i) => {
              const next = track.access[i + 1] ?? p;
              return intersects(bounds, {
                minX: Math.min(p.x, next.x) - 6,
                minY: Math.min(p.y, next.y) - 6,
                maxX: Math.max(p.x, next.x) + 6,
                maxY: Math.max(p.y, next.y) + 6,
              });
            }))
        )
          result.push(track);
      }
    return result;
  }
}

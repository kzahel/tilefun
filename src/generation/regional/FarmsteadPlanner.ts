import { TerrainId } from "../../autotile/TerrainId.js";
import { createProp } from "../../entities/PropFactories.js";
import { nearestRail } from "../../railway/RailPath.js";
import { RailwayPlanner } from "../../railway/RailwayPlanner.js";
import type { ActorPlacement } from "../Generator.js";
import { edgeHash } from "../RoadGenerator.js";
import type { FeaturePlacement } from "./DistrictStrategy.js";
import { pathDistance } from "./PlanGeometry.js";
import {
  type Bounds,
  connectionForOwner,
  intersects,
  type Point,
  plannedElevation,
  QUERY_LIMITS,
  queryRegion,
  REGION_SIZE,
} from "./RegionalPlanner.js";
import { regionalTerrainForElevation } from "./RegionalTerrain.js";
import { residentFauna } from "./ResidentFauna.js";
import type { RegionalWorld } from "./WorldDescriptor.js";

export interface Farmstead {
  id: string;
  connectionId: string;
  center: Point;
  bounds: Bounds;
  reservation: Bounds;
  paths: Point[][];
  crops: Bounds;
  pasture: Bounds;
  props: FeaturePlacement[];
  actors: ActorPlacement[];
}
const inside = (b: Bounds, x: number, y: number, r = 0) =>
  x >= b.minX - r && x <= b.maxX + r && y >= b.minY - r && y <= b.maxY + r;

/** Pure upstream rural reservations: no natural-cover or wildlife planner calls. */
export class FarmsteadSource {
  private cache = new Map<string, Farmstead | null>();
  private railways: RailwayPlanner;
  constructor(readonly world: RegionalWorld) {
    this.railways = new RailwayPlanner(world);
  }
  owner(cx: number, cy: number, axis: "east" | "south"): Farmstead | null {
    const key = `${cx}:${cy}:${axis}`;
    if (this.cache.has(key)) return this.cache.get(key) ?? null;
    const plan = this.build(cx, cy, axis);
    this.cache.set(key, plan);
    if (this.cache.size > 64) this.cache.delete(this.cache.keys().next().value ?? "");
    return plan;
  }
  private build(cx: number, cy: number, axis: "east" | "south"): Farmstead | null {
    const seed = this.world.seed;
    const salt = axis === "east" ? 32101 : 32117;
    if (edgeHash(cx, cy, seed + salt) > 0.65) return null;
    const connection = connectionForOwner(this.world, cx, cy, axis);
    if (!connection) return null;
    const segments = connection.points
      .slice(1)
      .map((b, i) => {
        const a = connection.points[i];
        if (!a) throw Error("Missing rural road endpoint");
        return { a, b, length: Math.hypot(b.x - a.x, b.y - a.y) };
      })
      .sort((a, b) => b.length - a.length);
    const segment = segments[0];
    if (!segment || segment.length < 360) return null;
    const horizontal = segment.a.y === segment.b.y;
    const t = 0.4 + edgeHash(cx, cy, seed + salt + 4) * 0.2;
    const entry = {
      x: Math.round(segment.a.x + (segment.b.x - segment.a.x) * t),
      y: Math.round(segment.a.y + (segment.b.y - segment.a.y) * t),
    };
    const preferred = edgeHash(cx, cy, seed + salt + 8) < 0.5 ? -1 : 1;
    for (const sign of [preferred, -preferred]) {
      const x = entry.x + (horizontal ? 0 : sign * 80);
      const y = entry.y + (horizontal ? sign * 80 : 0);
      const bounds = { minX: x - 40, minY: y - 34, maxX: x + 40, maxY: y + 30 };
      const gate = { x, y: y + 12 };
      const bend = horizontal ? { x: entry.x, y: gate.y } : { x: gate.x, y: entry.y };
      const paths = [
        [entry, bend, gate],
        [
          { x, y: y - 3.5 },
          { x: x - 14, y: y - 3.5 },
          { x: x - 14, y: y - 6.5 },
        ],
        [
          { x, y: y - 8 },
          { x: x + 14, y: y - 8 },
        ],
        [{ x, y: y - 8 }, gate],
        [gate, { x: x - 27, y: gate.y }],
      ];
      // Stop the shed approach outside its existing collision body.
      paths[2] = [
        { x, y: y - 6.5 },
        { x: x + 14, y: y - 6.5 },
        { x: x + 14, y: y - 8.5 },
      ];
      const reservation = {
        minX: Math.min(bounds.minX, entry.x - 4),
        minY: Math.min(bounds.minY, entry.y - 4),
        maxX: Math.max(bounds.maxX, entry.x + 4),
        maxY: Math.max(bounds.maxY, entry.y + 4),
      };
      const region = queryRegion(this.world, {
        bounds: reservation,
        detail: "region",
        sampleStep: 128,
        limits: QUERY_LIMITS,
      });
      if (region.settlements.some((s) => intersects(s.bounds, bounds))) continue;
      if (
        region.connections.some(
          (c) =>
            c.id !== connection.id &&
            (intersects(c.bounds, bounds) ||
              paths.some((path) => path.some((p) => pathDistance(c.points, p.x, p.y) < 14))),
        )
      )
        continue;
      const lines = this.railways.query(reservation);
      const blockedRail = (px: number, py: number, r: number) =>
        lines.some(
          (l) =>
            l.stations.some((s) => inside(s.platform, px, py, r) || inside(s.access, px, py, r)) ||
            l.bridges.some((b) => inside(b.bounds, px, py, r)) ||
            (l.path
              ? nearestRail(l.path, px * 16, py * 16).distance < (7 + r) * 16
              : px >= l.start - r && px <= l.end + r && Math.abs(py - l.y) < 3 + r),
        );
      const dry = (px: number, py: number) =>
        regionalTerrainForElevation(plannedElevation(this.world, px, py)) === TerrainId.Grass;
      let valid = true;
      for (let py = bounds.minY; py <= bounds.maxY && valid; py += 4)
        for (let px = bounds.minX; px <= bounds.maxX; px += 4)
          if (!dry(px, py) || blockedRail(px, py, 4)) {
            valid = false;
            break;
          }
      for (const path of paths)
        for (let i = 1; i < path.length && valid; i++) {
          const a = path[i - 1],
            b = path[i];
          if (!a || !b) continue;
          const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2));
          for (let j = 0; j <= steps && valid; j++) {
            const px = a.x + ((b.x - a.x) * j) / steps,
              py = a.y + ((b.y - a.y) * j) / steps;
            if (
              blockedRail(px, py, 4) ||
              [-3, 0, 3].some((d) => !dry(px + (a.y !== b.y ? d : 0), py + (a.x !== b.x ? d : 0)))
            )
              valid = false;
          }
        }
      if (!valid) continue;
      const id = `farmstead:${cx}:${cy}:${axis}`;
      const props: FeaturePlacement[] = [
        {
          featureId: `${id}:house`,
          propType: "prop-country-house",
          wx: (x - 14) * 16,
          wy: (y - 7) * 16,
        },
        { featureId: `${id}:shed`, propType: "prop-shed", wx: (x + 14) * 16, wy: (y - 9) * 16 },
      ];
      const crops = { minX: x - 35, minY: y + 1, maxX: x - 22, maxY: y + 11 };
      for (let row = 0; row < 4; row++)
        for (let col = 0; col < 5; col++)
          props.push({
            featureId: `${id}:crop:${row}:${col}`,
            propType: col % 2 ? "prop-regional-berries" : "prop-regional-seedling",
            wx: (crops.minX + 1.5 + col * 2.5) * 16,
            wy: (crops.minY + 1 + row * 2.5) * 16,
          });
      const pasture = { minX: x + 7, minY: y - 1, maxX: x + 35, maxY: y + 25 };
      const actors: ActorPlacement[] = [];
      for (const [i, species] of (
        ["cow", "cow", "sheep", "sheep", "goat", "piglet"] as const
      ).entries())
        actors.push(
          residentFauna(
            species,
            `${id}:${species}:${i}`,
            x + 12 + (i % 2) * 16,
            y + 4 + Math.floor(i / 2) * 7,
            pasture,
            seed,
            `${id}:${species}`,
          ),
        );
      return {
        id,
        connectionId: connection.id,
        center: { x, y },
        bounds,
        reservation,
        paths,
        crops,
        pasture,
        props,
        actors,
      };
    }
    return null;
  }
  query(bounds: Bounds): Farmstead[] {
    const result: Farmstead[] = [];
    const minX = Math.floor(bounds.minX / REGION_SIZE) - 1,
      maxX = Math.floor(bounds.maxX / REGION_SIZE) + 1;
    const minY = Math.floor(bounds.minY / REGION_SIZE) - 1,
      maxY = Math.floor(bounds.maxY / REGION_SIZE) + 1;
    if ((maxX - minX + 1) * (maxY - minY + 1) > 144) return result;
    for (let cy = minY; cy <= maxY; cy++)
      for (let cx = minX; cx <= maxX; cx++)
        for (const axis of ["east", "south"] as const) {
          const p = this.owner(cx, cy, axis);
          if (p && intersects(p.reservation, bounds)) result.push(p);
        }
    return result;
  }
  reserved(plans: readonly Farmstead[], x: number, y: number, r: number): boolean {
    return plans.some(
      (p) => inside(p.bounds, x, y, r) || p.paths.some((path) => pathDistance(path, x, y) <= 3 + r),
    );
  }
  terrain(plans: readonly Farmstead[], x: number, y: number): TerrainId | undefined {
    for (const p of plans) {
      if (p.paths.some((path) => pathDistance(path, x, y) <= 1.25)) return TerrainId.DirtLight;
      if (inside(p.crops, x, y)) return TerrainId.DirtWarm;
    }
    return undefined;
  }
  placements(plans: readonly Farmstead[], bounds: Bounds): FeaturePlacement[] {
    return plans
      .flatMap((p) => p.props)
      .filter((p) => {
        const prop = createProp(p.propType, p.wx, p.wy);
        const w = prop.sprite.spriteWidth / 16,
          h = prop.sprite.spriteHeight / 16;
        return intersects(bounds, {
          minX: p.wx / 16 - w / 2,
          maxX: p.wx / 16 + w / 2,
          minY: p.wy / 16 - h,
          maxY: p.wy / 16 + 1,
        });
      });
  }
  get cacheSize() {
    return this.cache.size;
  }
}

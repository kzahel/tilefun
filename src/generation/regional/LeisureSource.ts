import { nearestRail } from "../../railway/RailPath.js";
import type { RailwayPlanner } from "../../railway/RailwayPlanner.js";
import type { DenseDistrictPlan } from "./DenseDistrictPlanner.js";
import type { DenseDistrictSource } from "./DenseDistrictSource.js";
import type { FarmsteadSource } from "./FarmsteadPlanner.js";
import { leisureCells } from "./LeisureCells.js";
import { type LeisurePlace, leisurePlace } from "./LeisurePlaces.js";
import { type MotocrossSource, motocrossReserved } from "./MotocrossPlanner.js";
import { OwnerPlanCache } from "./OwnerPlanCache.js";
import { pathDistance } from "./PlanGeometry.js";
import { type RacetrackSource, racetrackReserved } from "./RacetrackPlanner.js";
import { regionalHash } from "./RegionalGeography.js";
import {
  type Bounds,
  intersects,
  type Point,
  plannedElevation,
  plannedMoisture,
  QUERY_LIMITS,
  queryRegion,
  REGION_SIZE,
  settlementForOwner,
} from "./RegionalPlanner.js";
import type { RegionalWorld } from "./WorldDescriptor.js";

interface Site {
  center: Point;
  bounds: Bounds;
  gate: Point;
  second: Point;
  coast: boolean;
  score: number;
}

function withinOwner(b: Bounds, cx: number, cy: number) {
  return (
    b.minX >= cx * REGION_SIZE &&
    b.maxX < (cx + 1) * REGION_SIZE &&
    b.minY >= cy * REGION_SIZE &&
    b.maxY < (cy + 1) * REGION_SIZE
  );
}
/** Sites and both entrances stay wholly within one settlement owner. Infrastructure
 * is upstream; ponds, tree stands and animal homes consult the accepted reservation. */
export class LeisureSource {
  private readonly plans = new OwnerPlanCache((_world, cx, cy) => this.plan(cx, cy));
  constructor(
    private readonly world: RegionalWorld,
    private readonly districts: DenseDistrictSource,
    private readonly farms: FarmsteadSource,
    private readonly rails: RailwayPlanner,
    private readonly tracks: RacetrackSource,
    private readonly motocross: MotocrossSource,
  ) {}
  owner(cx: number, cy: number) {
    return this.plans.get(this.world, cx, cy);
  }
  query(bounds: Bounds) {
    const places: LeisurePlace[] = [];
    for (const { x, y } of leisureCells(bounds, REGION_SIZE)) {
      const p = this.owner(x, y);
      if (p && intersects(p.bounds, bounds)) places.push(p);
    }
    return places;
  }
  private plan(cx: number, cy: number) {
    const town = settlementForOwner(this.world, cx, cy);
    if (!town) return null;
    const plan = this.districts.owner(cx, cy);
    if (!plan) return null;
    const hash = (salt: number) => regionalHash(cx, cy, this.world.seed, salt);
    const sites: Site[] = [];
    for (const side of [-1, 1]) {
      const rows = plan.gridBounds ? [-100, -60, -20, 20] : [-20, 20];
      for (const offset of rows) this.sideSites(plan, cx, cy, side, true, offset, sites);
      if (side > 0 || !plan.shoppingCenters?.length)
        for (const offset of [-20, 20]) this.sideSites(plan, cx, cy, side, false, offset, sites);
    }
    sites.sort((a, b) => b.score - a.score);
    const site = sites.find((candidate) => this.clear(candidate));
    if (site) {
      // Offset adjoining owner cells' preference, with small variation from the seed.
      const preferCamp = (cx + cy + this.world.seed) % 2 === 0;
      const garden = preferCamp === hash(46019) < 0.25;
      const kind = site.coast ? "beach" : garden ? "garden" : "camp";
      const label =
        kind === "garden" ? "Garden park" : kind === "camp" ? "Woodland camp" : "Town beach";
      return leisurePlace(
        kind,
        `${town.id}:outing`,
        `${town.name} · ${label}`,
        site.center,
        site.bounds,
        site.gate,
        hash(47017),
        site.second,
      );
    }
    return null;
  }
  private sideSites(
    plan: DenseDistrictPlan,
    cx: number,
    cy: number,
    side: number,
    horizontal: boolean,
    offset: number,
    sites: Site[],
  ) {
    const grid = plan.gridBounds ?? plan.bounds;
    const edge = horizontal ? (side < 0 ? grid.minX : grid.maxX) : side < 0 ? grid.minY : grid.maxY;
    const along = (horizontal ? plan.center.y : plan.center.x) + offset;
    const point = (out: number, across: number) =>
      horizontal
        ? { x: edge + side * out, y: along + across }
        : { x: along + across, y: edge + side * out };
    const gate = point(0, 18),
      second = point(0, -18);
    for (const dist of [24, 64, 104]) {
      const center = point(dist, 0),
        water = point(dist + 18, 0);
      const coast =
        plannedElevation(this.world, water.x, water.y) < 0 &&
        plannedElevation(this.world, center.x, center.y) < 0.08;
      if (dist !== 24 && !coast) continue;
      const extent = coast ? 10 : 19;
      const bounds = {
        minX: Math.min(gate.x, second.x, center.x - extent),
        maxX: Math.max(gate.x, second.x, center.x + extent) + 1,
        minY: Math.min(gate.y, second.y, center.y - extent),
        maxY: Math.max(gate.y, second.y, center.y + extent) + 1,
      };
      if (!withinOwner(bounds, cx, cy)) continue;
      sites.push({
        center,
        bounds,
        gate,
        second,
        coast,
        score:
          (coast ? 10 : 0) +
          plannedMoisture(this.world, center.x, center.y) +
          regionalHash(cx, cy, this.world.seed, 43207 + sites.length) * 0.6,
      });
    }
  }
  private clear({ bounds, coast }: Site) {
    const farms = this.farms.query(bounds),
      tracks = this.tracks.query(bounds),
      parks = this.motocross.query(bounds),
      lines = this.rails.query(bounds);
    const { connections } = queryRegion(this.world, {
      bounds,
      detail: "region",
      limits: QUERY_LIMITS,
      sampleStep: 128,
    });
    for (let y = bounds.minY; y <= bounds.maxY + 3; y += 3)
      for (let x = bounds.minX; x <= bounds.maxX + 3; x += 3) {
        if (
          plannedElevation(this.world, x, y) < (coast ? 0.002 : 0.055) ||
          this.farms.reserved(farms, x, y, 3) ||
          tracks.some((t) => racetrackReserved(t, x, y, 3)) ||
          parks.some((p) => motocrossReserved(p, x, y, 3)) ||
          connections.some((c) => pathDistance(c.points, x, y) < c.width / 2 + 3) ||
          lines.some(
            (l) =>
              nearestRail(l.path, x * 16, y * 16).distance < 10 * 16 ||
              l.stations.some((s) => [s.platform, s.access].some((b) => intersects(bounds, b))) ||
              l.bridges.some((b) => intersects(b.bounds, bounds)),
          )
        )
          return false;
      }
    return true;
  }
}

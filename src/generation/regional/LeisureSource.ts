import { nearestRail } from "../../railway/RailPath.js";
import type { RailwayPlanner } from "../../railway/RailwayPlanner.js";
import type { DenseDistrictSource } from "./DenseDistrictSource.js";
import type { FarmsteadSource } from "./FarmsteadPlanner.js";
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
    for (
      let cy = Math.floor(bounds.minY / REGION_SIZE);
      cy <= Math.floor(bounds.maxY / REGION_SIZE);
      cy++
    )
      for (
        let cx = Math.floor(bounds.minX / REGION_SIZE);
        cx <= Math.floor(bounds.maxX / REGION_SIZE);
        cx++
      ) {
        const p = this.owner(cx, cy);
        if (p && intersects(p.bounds, bounds)) places.push(p);
      }
    return places;
  }
  private plan(cx: number, cy: number) {
    const town = settlementForOwner(this.world, cx, cy);
    if (!town) return null;
    const plan = this.districts.owner(cx, cy);
    if (!plan) return null;
    const grid = plan.gridBounds ?? plan.bounds;
    const hash = (salt: number) => regionalHash(cx, cy, this.world.seed, salt);
    const sites: Site[] = [];
    for (const side of [-1, 1])
      for (const horizontal of [true, false])
        for (const offset of horizontal && plan.gridBounds ? [-100, -60, -20, 20] : [-20, 20]) {
          // The north shopping frontage owns the entire approach from that side.
          if (!horizontal && side === -1 && plan.shoppingCenters?.length) continue;
          const edge = horizontal
            ? side < 0
              ? grid.minX
              : grid.maxX
            : side < 0
              ? grid.minY
              : grid.maxY;
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
            if (
              Math.floor(bounds.minX / REGION_SIZE) !== cx ||
              Math.floor(bounds.maxX / REGION_SIZE) !== cx ||
              Math.floor(bounds.minY / REGION_SIZE) !== cy ||
              Math.floor(bounds.maxY / REGION_SIZE) !== cy
            )
              continue;
            sites.push({
              center,
              bounds,
              gate,
              second,
              coast,
              score:
                (coast ? 10 : 0) +
                plannedMoisture(this.world, center.x, center.y) +
                hash(43207 + sites.length) * 0.6,
            });
          }
        }
    sites.sort((a, b) => b.score - a.score);
    for (const site of sites) {
      if (!this.clear(site)) continue;
      // Offset adjoining owner cells' preference, with small variation from the seed.
      const preferCamp = (cx + cy + this.world.seed) % 2 === 0;
      const garden = hash(46019) < 0.25 ? preferCamp : !preferCamp;
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

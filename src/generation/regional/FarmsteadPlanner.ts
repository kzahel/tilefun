import { TerrainId } from "../../autotile/TerrainId.js";
import { CHUNK_SIZE, CHUNK_SIZE_PX } from "../../config/constants.js";
import { createProp } from "../../entities/PropFactories.js";
import {
  CHICKEN_FEEDER,
  FENCE_STAKES,
  GARDEN_BED,
  GARDEN_FENCE,
  GARDEN_FENCE_SIDE,
  WOODLOT_TREE,
} from "../../farming/FarmActors.js";
import { FARM_GATE } from "../../farming/FarmGate.js";
import { nearestRail } from "../../railway/RailPath.js";
import { RailwayPlanner } from "../../railway/RailwayPlanner.js";
import type { ActorPlacement } from "../Generator.js";
import { edgeHash } from "../RoadGenerator.js";
import type { FeaturePlacement } from "../StructureGenerator.js";
import { DenseDistrictSource } from "./DenseDistrictSource.js";
import { MotocrossSource, motocrossReserved } from "./MotocrossPlanner.js";
import { pathDistance } from "./PlanGeometry.js";
import { RacetrackSource, racetrackReserved } from "./RacetrackPlanner.js";
import {
  type Bounds,
  connectionForOwner,
  intersects,
  type Point,
  plannedElevation,
  QUERY_LIMITS,
  queryRegion,
  REGION_SIZE,
  settlementForOwner,
} from "./RegionalPlanner.js";
import { regionalTerrainForElevation } from "./RegionalTerrain.js";
import { residentFauna } from "./ResidentFauna.js";
import type { RegionalWorld } from "./WorldDescriptor.js";

export interface Farmstead {
  id: string;
  connectionId: string;
  townName: string;
  nearTown: boolean;
  arrival: Point;
  garden: ActorPlacement[];
  center: Point;
  bounds: Bounds;
  reservation: Bounds;
  paths: Point[][];
  crops: Bounds;
  pasture: Bounds;
  props: FeaturePlacement[];
  actors: ActorPlacement[];
}
export interface FarmDestination {
  id: string;
  name: string;
  arrival: Point;
}

export function farmDestination(farm: Farmstead): FarmDestination {
  return { id: farm.id, name: `${farm.townName} Farm`, arrival: farm.arrival };
}

const inside = (b: Bounds, x: number, y: number, r = 0) =>
  x >= b.minX - r && x <= b.maxX + r && y >= b.minY - r && y <= b.maxY + r;

/** Pure upstream rural reservations: no natural-cover or wildlife planner calls. */
export class FarmsteadSource {
  private cache = new Map<string, Farmstead | null>();
  private townCache = new Map<string, Farmstead | null>();
  private railways: RailwayPlanner;
  private readonly districts: DenseDistrictSource;
  private readonly racetracks: RacetrackSource;
  private readonly motocross: MotocrossSource;
  constructor(readonly world: RegionalWorld) {
    this.railways = new RailwayPlanner(world);
    this.districts = new DenseDistrictSource(world, true);
    this.racetracks = new RacetrackSource(world);
    this.motocross = new MotocrossSource(world, this.racetracks);
  }
  owner(cx: number, cy: number, axis: "east" | "south"): Farmstead | null {
    const key = `${cx}:${cy}:${axis}`;
    if (this.cache.has(key)) return this.cache.get(key) ?? null;
    const plan = this.build(cx, cy, axis);
    this.cache.set(key, plan);
    if (this.cache.size > 64) this.cache.delete(this.cache.keys().next().value ?? "");
    return plan;
  }
  /** One road-connected farm on each town's outskirts when the terrain admits it. */
  townOwner(cx: number, cy: number): Farmstead | null {
    const key = `${cx}:${cy}`;
    if (this.townCache.has(key)) return this.townCache.get(key) ?? null;
    const plan = this.build(cx, cy, "east", true) ?? this.build(cx, cy, "south", true);
    this.townCache.set(key, plan);
    if (this.townCache.size > 64) this.townCache.delete(this.townCache.keys().next().value ?? "");
    return plan;
  }

  private build(
    cx: number,
    cy: number,
    axis: "east" | "south",
    nearTown = false,
  ): Farmstead | null {
    const seed = this.world.seed;
    const salt = axis === "east" ? 32101 : 32117;
    if (!nearTown && edgeHash(cx, cy, seed + salt) > 0.65) return null;
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
    const segment = nearTown ? segments.find((s) => s.a === connection.points[0]) : segments[0];
    if (!segment || segment.length < (nearTown ? 260 : 360)) return null;
    const town = settlementForOwner(this.world, cx, cy);
    const nextTown = settlementForOwner(
      this.world,
      cx + Number(axis === "east"),
      cy + Number(axis === "south"),
    );
    if (!town || !nextTown) return null;
    const horizontal = segment.a.y === segment.b.y;
    const t = nearTown
      ? Math.min(205 / segment.length, 0.5)
      : 0.4 + edgeHash(cx, cy, seed + salt + 4) * 0.2;
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
      const legacy = nearTown ? this.owner(cx, cy, axis) : null;
      if (legacy && intersects(legacy.reservation, reservation)) continue;
      const region = queryRegion(this.world, {
        bounds: reservation,
        detail: "region",
        sampleStep: 128,
        limits: QUERY_LIMITS,
      });
      if (
        this.districts.query(bounds).some((p) => intersects(p.bounds, bounds)) ||
        region.settlements.some((s) => intersects(s.bounds, bounds))
      )
        continue;
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
      const tracks = this.racetracks.query(reservation);
      const parks = this.motocross.query(reservation);
      const blockedRail = (px: number, py: number, r: number) =>
        lines.some(
          (l) =>
            l.stations.some((s) => inside(s.platform, px, py, r) || inside(s.access, px, py, r)) ||
            l.bridges.some((b) => inside(b.bounds, px, py, r)) ||
            nearestRail(l.path, px * 16, py * 16).distance < (7 + r) * 16,
        );
      const dry = (px: number, py: number) =>
        regionalTerrainForElevation(plannedElevation(this.world, px, py)) === TerrainId.Grass;
      let valid = true;
      for (let py = bounds.minY; py <= bounds.maxY && valid; py += 4)
        for (let px = bounds.minX; px <= bounds.maxX; px += 4)
          if (
            !dry(px, py) ||
            blockedRail(px, py, 4) ||
            tracks.some((t) => racetrackReserved(t, px, py, 4)) ||
            parks.some((p) => motocrossReserved(p, px, py, 4))
          ) {
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
              tracks.some((t) => racetrackReserved(t, px, py, 4)) ||
              parks.some((p) => motocrossReserved(p, px, py, 4)) ||
              [-3, 0, 3].some((d) => !dry(px + (a.y !== b.y ? d : 0), py + (a.x !== b.x ? d : 0)))
            )
              valid = false;
          }
        }
      if (!valid) continue;
      const id = `${nearTown ? "town-farm" : "farmstead"}:${cx}:${cy}:${axis}`;
      const closest =
        Math.hypot(town.center.x - x, town.center.y - y) <=
        Math.hypot(nextTown.center.x - x, nextTown.center.y - y)
          ? town
          : nextTown;
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
      const garden = this.garden(id, x, y);
      props.push({
        featureId: `${id}:hen-gate`,
        propType: FARM_GATE,
        wx: (x - 18.5) * 16,
        wy: (y + 20) * 16,
      });
      // The south gate leads in from the feeder.
      for (const [dx, dy, type] of [
        ...[-21, -19, -17, -15].map((dx) => [dx, 13, GARDEN_FENCE] as const),
        ...[14, 16, 18, 20].flatMap((dy) => [
          [-22.5, dy, GARDEN_FENCE_SIDE] as const,
          [-14, dy, GARDEN_FENCE_SIDE] as const,
        ]),
        [-21, 20, GARDEN_FENCE],
        [-16, 20, GARDEN_FENCE],
      ] as const)
        props.push({
          featureId: `${id}:pen:${dx}:${dy}`,
          propType: type,
          wx: (x + dx) * 16,
          wy: (y + dy) * 16,
        });
      return {
        id,
        townName: closest.name,
        nearTown,
        arrival: { x: x - 26, y: y + 13.5 },
        garden,
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
  private garden(id: string, x: number, y: number): ActorPlacement[] {
    const placement = (suffix: string, type: string, dx: number, dy: number): ActorPlacement => ({
      featureId: `${id}:garden:${suffix}`,
      type,
      wx: (x + dx) * 16,
      wy: (y + dy) * 16,
      route: [],
    });
    const pen = { minX: x - 22, minY: y + 13, maxX: x - 15, maxY: y + 20 };
    return [
      ...[-32, -29, -26, -23].map((dx, i) => placement(`bed:${i}`, GARDEN_BED, dx, 15)),
      placement("feeder", CHICKEN_FEEDER, -19, 19),
      placement("tree", WOODLOT_TREE, -31, 21),
      placement("tree:2", WOODLOT_TREE, -33, 24),
      placement("fence", FENCE_STAKES, -26, 18),
      ...[0, 1, 2].map((i) =>
        residentFauna(
          "chicken",
          `${id}:garden:hen:${i}`,
          x - 21 + i * 2,
          y + 16,
          pen,
          this.world.seed,
          `${id}:garden:hens`,
        ),
      ),
    ];
  }

  query(bounds: Bounds): Farmstead[] {
    const result: Farmstead[] = [];
    const minX = Math.floor(bounds.minX / REGION_SIZE) - 1,
      maxX = Math.floor(bounds.maxX / REGION_SIZE) + 1;
    const minY = Math.floor(bounds.minY / REGION_SIZE) - 1,
      maxY = Math.floor(bounds.maxY / REGION_SIZE) + 1;
    if ((maxX - minX + 1) * (maxY - minY + 1) > 144) return result;
    for (let cy = minY; cy <= maxY; cy++)
      for (let cx = minX; cx <= maxX; cx++) {
        for (const axis of ["east", "south"] as const) {
          const p = this.owner(cx, cy, axis);
          if (p && intersects(p.reservation, bounds)) result.push(p);
        }
        const town = this.townOwner(cx, cy);
        if (town && intersects(town.reservation, bounds)) result.push(town);
      }
    return result;
  }

  gardenActors(cx: number, cy: number): ActorPlacement[] {
    const bounds = {
      minX: cx * CHUNK_SIZE,
      minY: cy * CHUNK_SIZE,
      maxX: (cx + 1) * CHUNK_SIZE,
      maxY: (cy + 1) * CHUNK_SIZE,
    };
    return this.query(bounds)
      .flatMap((farm) => farm.garden)
      .filter(
        (a) => Math.floor(a.wx / CHUNK_SIZE_PX) === cx && Math.floor(a.wy / CHUNK_SIZE_PX) === cy,
      );
  }

  /** A bounded map search around the player, including when the nearest farm is offscreen. */
  nearestTownFarm(point: Point): FarmDestination | undefined {
    const radius = 3 * REGION_SIZE;
    const farms = this.query({
      minX: point.x - radius,
      minY: point.y - radius,
      maxX: point.x + radius,
      maxY: point.y + radius,
    });
    const distance = ({ arrival }: Farmstead) =>
      Math.hypot(point.x - arrival.x, point.y - arrival.y);
    const first = farms.sort(
      (a, b) =>
        Number(b.nearTown) - Number(a.nearTown) ||
        distance(a) - distance(b) ||
        a.id.localeCompare(b.id),
    )[0];
    return first && farmDestination(first);
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

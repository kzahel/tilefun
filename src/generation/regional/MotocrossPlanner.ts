import { TerrainId } from "../../autotile/TerrainId.js";
import { Direction } from "../../entities/Entity.js";
import { nearestRail } from "../../railway/RailPath.js";
import { RailwayPlanner } from "../../railway/RailwayPlanner.js";
import { RoadType } from "../../road/RoadType.js";
import type { ActorPlacement } from "../Generator.js";
import { DenseDistrictSource, insideDenseBounds } from "./DenseDistrictPlanner.js";
import type { FeaturePlacement } from "./DistrictStrategy.js";
import { type JumpDirection, type JumpName, jumpLength, jumpPlacements } from "./JumpProfiles.js";
import { pathDistance } from "./PlanGeometry.js";
import { RacetrackSource } from "./RacetrackPlanner.js";
import {
  type Bounds,
  intersects,
  type Point,
  plannedElevation,
  QUERY_LIMITS,
  queryRegion,
  REGION_SIZE,
  settlementForOwner,
} from "./RegionalPlanner.js";
import { regionalTerrainForElevation } from "./RegionalTerrain.js";
import { type DepotVehicle, intersectingPlacements } from "./VehicleDepotPlanner.js";
import type { RegionalWorld } from "./WorldDescriptor.js";

export interface MotocrossPark {
  id: string;
  name: string;
  center: Point;
  bounds: Bounds;
  access: Point[];
  /** Open pit-row ground beyond the parked cars, for map travel. */
  arrival: Point;
  /** Beside the start-line car at the west end of the north straight. */
  start: Point;
  /** Half the length of each straight, tiles. */
  straight: number;
  props: FeaturePlacement[];
  actors: ActorPlacement[];
  vehicles: DepotVehicle[];
}

/** Lane centre radius of the dirt loop and half its width, tiles; jump lanes
 * (128px) sit exactly on the straights. */
export const MX_RADIUS = 20;
const HALF_LANE = 4.5;
const RUN_UP = 20,
  SPACING = 14,
  TAIL = 8;
/** North straight runs east, south straight west, infield practice lane east. */
const LANES: readonly { dy: number; direction: JumpDirection; jumps: readonly JumpName[] }[] = [
  { dy: -MX_RADIUS, direction: "e", jumps: ["sky", "double"] },
  { dy: MX_RADIUS, direction: "w", jumps: ["kicker", "tabletop"] },
];
const PRACTICE: JumpName = "rollers";
const START_MODEL = "rally-hatchback";
const PIT_MODELS = ["beach-buggy", "monster-truck", "open-wheel-racer", "race-coupe", "go-kart"];
const laneLength = (jumps: readonly JumpName[]) =>
  RUN_UP + jumps.reduce((n, j) => n + jumpLength(j) / 16, 0) + SPACING * (jumps.length - 1) + TAIL;
/** Half straight length, tiles: fits the longest lane. */
const STRAIGHT = Math.ceil(Math.max(...LANES.map((l) => laneLength(l.jumps))) / 2);
const HALF_WIDTH = STRAIGHT + MX_RADIUS + 6;
const NORTH = MX_RADIUS + 7,
  SOUTH = MX_RADIUS + 14;

/** Distance from the loop's straight centreline; the lane follows MX_RADIUS. */
export function motocrossRadius(park: MotocrossPark, x: number, y: number): number {
  return Math.hypot(Math.max(0, Math.abs(x - park.center.x) - park.straight), y - park.center.y);
}

export function motocrossReserved(park: MotocrossPark, x: number, y: number, r = 0): boolean {
  return (
    insideDenseBounds(
      {
        minX: park.bounds.minX - r,
        minY: park.bounds.minY - r,
        maxX: park.bounds.maxX + r,
        maxY: park.bounds.maxY + r,
      },
      x,
      y,
    ) || pathDistance(park.access, x, y) <= 5 + r
  );
}

/** Dirt loop and practice lane at half-tile terrain resolution; grass elsewhere. */
export function motocrossTerrain(park: MotocrossPark, x: number, y: number): TerrainId {
  const dx = x - park.center.x,
    dy = y - park.center.y;
  const loop = Math.abs(motocrossRadius(park, x, y) - MX_RADIUS) < HALF_LANE;
  const practice = Math.abs(dy) < HALF_LANE && Math.abs(dx) < jumpLength(PRACTICE) / 32 + 8;
  return loop || practice ? TerrainId.DirtWarm : TerrainId.Grass;
}

/** Paved pit row and access road; the loop itself is unpaved. */
export function motocrossRoad(park: MotocrossPark, x: number, y: number): number {
  const dx = Math.abs(x + 0.5 - park.center.x),
    dy = y + 0.5 - park.center.y;
  if (dx <= 34 && dy >= MX_RADIUS + 6 && dy < SOUTH) return RoadType.Asphalt;
  const access = pathDistance(park.access, x + 0.5, y + 0.5);
  return access <= 3 ? RoadType.Asphalt : access <= 5 ? RoadType.CityPavement : RoadType.None;
}

/** Every slab or scenery prop whose footprint meets the bounds (tile units). */
export function motocrossPlacements(park: MotocrossPark, bounds: Bounds) {
  return intersectingPlacements(park.props, bounds);
}

/** City outskirts motocross parks (224), opposite the speedway. Independent
 * upstream reservations; no natural-cover or wildlife planner dependencies. */
export class MotocrossSource {
  private cache = new Map<string, MotocrossPark | null>();
  private districts: DenseDistrictSource;
  private railways: RailwayPlanner;
  constructor(
    readonly world: RegionalWorld,
    private readonly racetracks = new RacetrackSource(world),
  ) {
    this.districts = new DenseDistrictSource(world, true);
    this.railways = new RailwayPlanner(world);
  }
  owner(cx: number, cy: number): MotocrossPark | null {
    const key = `${cx},${cy}`;
    if (this.cache.has(key)) return this.cache.get(key) ?? null;
    const result = this.plan(cx, cy);
    this.cache.set(key, result);
    if (this.cache.size > 64) this.cache.delete(this.cache.keys().next().value ?? "");
    return result;
  }
  private plan(cx: number, cy: number): MotocrossPark | null {
    const city = this.districts.owner(cx, cy);
    const settlement = settlementForOwner(this.world, cx, cy);
    if (!city || settlement?.kind !== "city") return null;
    const speedway = this.racetracks.owner(cx, cy);
    const sides = speedway ? [speedway.center.x > city.center.x ? -1 : 1] : [1, -1];
    for (const side of sides) {
      const edge = side > 0 ? city.bounds.maxX : city.bounds.minX;
      const x = edge + side * (HALF_WIDTH + 10),
        y = city.center.y - SOUTH - 14;
      const bounds = {
        minX: x - HALF_WIDTH,
        minY: y - NORTH,
        maxX: x + HALF_WIDTH,
        maxY: y + SOUTH,
      };
      const grid = city.gridBounds ?? city.bounds;
      const access = [
        { x: side > 0 ? grid.maxX - 4 : grid.minX + 4, y: city.center.y },
        { x, y: city.center.y },
        { x, y: y + SOUTH - 2 },
      ];
      if (!this.clear(bounds, access, { cx, cy }, speedway?.bounds)) continue;
      return this.layout(city.id, settlement.name, { x, y }, bounds, access);
    }
    return null;
  }
  /** Dry, away from intercity roads, railways, other settlements and the speedway.
   * The town's own settlement reservation is wider than its built plan. */
  private clear(
    bounds: Bounds,
    access: Point[],
    own: { cx: number; cy: number },
    speedway?: Bounds,
  ) {
    const reservation = { ...bounds, maxY: Math.max(bounds.maxY, (access[0]?.y ?? 0) + 6) };
    if (speedway && intersects(speedway, { ...reservation, minX: reservation.minX - 12 }))
      return false;
    const region = queryRegion(this.world, {
      bounds: reservation,
      detail: "region",
      sampleStep: 128,
      limits: QUERY_LIMITS,
    });
    if (
      region.settlements.some(
        (s) =>
          (s.owner.cx !== own.cx || s.owner.cy !== own.cy) &&
          intersects(s.bounds, {
            minX: bounds.minX - 8,
            minY: bounds.minY - 8,
            maxX: bounds.maxX + 8,
            maxY: bounds.maxY + 8,
          }),
      )
    )
      return false;
    const lines = this.railways.query(reservation);
    for (let py = bounds.minY; py <= bounds.maxY; py += 4)
      for (let px = bounds.minX; px <= bounds.maxX; px += 4) {
        if (
          region.connections.some((c) => pathDistance(c.points, px, py) < 12) ||
          lines.some((l) => nearestRail(l.path, px * 16, py * 16).distance < 12 * 16)
        )
          return false;
      }
    for (let py = bounds.minY; py <= bounds.maxY; py += 8)
      for (let px = bounds.minX; px <= bounds.maxX; px += 8)
        if (regionalTerrainForElevation(plannedElevation(this.world, px, py)) !== TerrainId.Grass)
          return false;
    return true;
  }
  private layout(cityId: string, town: string, center: Point, bounds: Bounds, access: Point[]) {
    const id = `${cityId}:motocross`,
      { x, y } = center;
    const props: FeaturePlacement[] = [];
    const actors: ActorPlacement[] = [];
    for (const lane of LANES) {
      // Each lane starts after a run-up from its own end of the straight.
      let travel = RUN_UP;
      for (const jump of lane.jumps) {
        const startX = lane.direction === "e" ? x - STRAIGHT + travel : x + STRAIGHT - travel;
        props.push(
          ...jumpPlacements(
            jump,
            lane.direction,
            startX * 16,
            (y + lane.dy) * 16,
            `${id}:jump:${jump}`,
          ),
        );
        travel += jumpLength(jump) / 16 + SPACING;
      }
    }
    props.push(
      ...jumpPlacements(
        PRACTICE,
        "e",
        (x - jumpLength(PRACTICE) / 32) * 16,
        y * 16,
        `${id}:jump:${PRACTICE}`,
      ),
    );
    const add = (suffix: string, propType: string, dx: number, dy: number) =>
      props.push({ featureId: `${id}:${suffix}`, propType, wx: (x + dx) * 16, wy: (y + dy) * 16 });
    // Spectators watch the big north jumps from outside the loop.
    for (let i = 0; i < 8; i++) {
      const dx = -STRAIGHT + 24 + i * 16,
        dy = -MX_RADIUS - 6;
      add(`bench:${i}`, "prop-bench", dx, dy);
      actors.push({
        featureId: `${id}:spectator:${i}`,
        type: `person${1 + ((i * 7 + 3) % 20)}`,
        wx: (x + dx + 1.8) * 16,
        wy: (y + dy) * 16,
        route: [
          { wx: (x + dx + 1.8) * 16, wy: (y + dy + 0.5) * 16, waitSeconds: 20 },
          { wx: (x + dx + 1.8) * 16, wy: (y + dy) * 16, waitSeconds: 2 },
        ],
      });
    }
    for (const dx of [-36, 36]) add(`lamp:${dx}`, "prop-street-lamp", dx, SOUTH - 2);
    add("picnic", "prop-picnic-table", -STRAIGHT + 8, -MX_RADIUS - 5);
    add("umbrella", "prop-beach-umbrella", STRAIGHT - 8, -MX_RADIUS - 5);
    const vehicles = [
      // Waiting on the north straight's run-up: boost east over sky and double.
      {
        identity: `placed-vehicle-v1:${id}:start:${START_MODEL}`,
        model: START_MODEL,
        wx: (x - STRAIGHT + 2) * 16,
        wy: (y - MX_RADIUS) * 16,
        facing: Direction.Right,
      },
      ...PIT_MODELS.map((model, i) => ({
        identity: `placed-vehicle-v1:${id}:pit:${model}`,
        model,
        wx: (x - 22 + i * 11) * 16,
        wy: (y + MX_RADIUS + 9) * 16,
        facing: Direction.Right,
      })),
    ];
    return {
      id,
      name: `${town} Motocross park`,
      center,
      bounds,
      access,
      arrival: { x: x + 33, y: y + MX_RADIUS + 10 },
      start: { x: x - STRAIGHT + 2, y: y - MX_RADIUS + 3 },
      straight: STRAIGHT,
      props,
      actors,
      vehicles,
    };
  }
  query(bounds: Bounds): MotocrossPark[] {
    const query = this.querySteps(bounds);
    let step = query.next();
    while (!step.done) step = query.next();
    return step.value;
  }
  *querySteps(bounds: Bounds, maxOwners = 144): Generator<void, MotocrossPark[]> {
    const result: MotocrossPark[] = [];
    if (
      (Math.floor((bounds.maxX - bounds.minX) / REGION_SIZE) + 4) *
        (Math.floor((bounds.maxY - bounds.minY) / REGION_SIZE) + 4) >
      Math.min(144, maxOwners)
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
        const park = this.owner(cx, cy);
        if (
          park &&
          (intersects(park.bounds, bounds) ||
            park.access.some((p, i) => {
              const next = park.access[i + 1] ?? p;
              return intersects(bounds, {
                minX: Math.min(p.x, next.x) - 6,
                minY: Math.min(p.y, next.y) - 6,
                maxX: Math.max(p.x, next.x) + 6,
                maxY: Math.max(p.y, next.y) + 6,
              });
            }))
        )
          result.push(park);
        yield;
      }
    return result;
  }
}

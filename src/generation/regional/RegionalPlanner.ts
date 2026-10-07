import { TerrainId } from "../../autotile/TerrainId.js";
import { fbm } from "../noise.js";
import { regionalTerrainForElevation } from "./RegionalTerrain.js";
import { MAX_WORLD_COORDINATE, type RegionalWorld, validateWorld } from "./WorldDescriptor.js";

/** All planning positions and bounds are in tiles. Bounds are half-open. */
export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Point {
  x: number;
  y: number;
}

export const REGION_SIZE = 1024;
export const QUERY_LIMITS = { maxSamples: 24_576, maxOwners: 144, maxFeatures: 432 } as const;
export const LandCover = {
  Water: 0,
  Shore: 1,
  Meadow: 2,
  Woodland: 3,
  Rural: 4,
  Settlement: 5,
  DenseWoodland: 6,
  Thicket: 7,
} as const;

interface Feature {
  id: string;
  parentId: string;
  owner: { cx: number; cy: number };
  bounds: Bounds;
}

export interface Settlement extends Feature {
  kind: "city" | "village";
  name: string;
  center: Point;
  outline: Point[];
}

export interface Connection extends Feature {
  kind: "connection";
  settlementIds: [string, string];
  points: Point[];
  /** Full reserved corridor width. Detailed roads must fit inside this reservation. */
  width: number;
}

export interface RegionalRequest {
  bounds: Bounds;
  detail: "region" | "overview";
  sampleStep: number;
  limits: { maxSamples: number; maxOwners: number; maxFeatures: number };
}

export interface RegionalResult {
  world: RegionalWorld;
  bounds: Bounds;
  detail: "region" | "overview";
  grid: { x: number; y: number; step: number; width: number; height: number };
  elevation: Float32Array;
  moisture: Float32Array;
  cover: Uint8Array;
  settlements: Settlement[];
  connections: Connection[];
  stats: { samples: number; owners: number; features: number; detailedChunks: 0 };
}

export function intersects(a: Bounds, b: Bounds): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

function hash(cx: number, cy: number, seed: number, salt: number): number {
  let h = Math.imul(cx, 374761393) ^ Math.imul(cy, 668265263) ^ seed ^ salt;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 2 ** 32;
}

export function plannedMoisture(world: RegionalWorld, x: number, y: number): number {
  return fbm(x / 1100, y / 1100, world.seed + 2801, 2);
}

/** The regional geographic spine; local realization must consume these constraints. */
export function naturalElevation(world: RegionalWorld, x: number, y: number): number {
  return (
    fbm(x / 4096, y / 4096, world.seed, 3) * 0.72 +
    fbm(x / 640, y / 640, world.seed + 1709, 2) * 0.28
  );
}

const NAME_START = ["Maple", "Willow", "Ash", "Oak", "Fern", "Cedar", "Brook", "Birch"];
const NAME_END = ["ford", "haven", "field", "wick", "grove", "bridge", "stead", "vale"];

/** One independently addressable owner. No neighbor search or child construction. */
export function settlementForOwner(
  world: RegionalWorld,
  cx: number,
  cy: number,
): Settlement | null {
  const x = cx * REGION_SIZE + 288 + Math.floor(hash(cx, cy, world.seed, 101) * 448);
  const y = cy * REGION_SIZE + 288 + Math.floor(hash(cx, cy, world.seed, 211) * 448);
  if (hash(cx, cy, world.seed, 307) > 0.76 || naturalElevation(world, x, y) < 0.02) return null;
  const kind = hash(cx, cy, world.seed, 401) < 0.32 ? "city" : "village";
  const width = kind === "city" ? 320 + Math.floor(hash(cx, cy, world.seed, 503) * 64) : 128;
  const height = kind === "city" ? 256 + Math.floor(hash(cx, cy, world.seed, 601) * 64) : 112;
  const bounds = {
    minX: x - width / 2,
    minY: y - height / 2,
    maxX: x + width / 2,
    maxY: y + height / 2,
  };
  const { minX, minY, maxX, maxY } = bounds;
  const cut = kind === "city" ? 32 : 16;
  return {
    id: `settlement:${cx}:${cy}`,
    parentId: `region:${cx}:${cy}`,
    owner: { cx, cy },
    bounds,
    kind,
    name: `${NAME_START[Math.floor(hash(cx, cy, world.seed, 701) * NAME_START.length)]}${NAME_END[Math.floor(hash(cx, cy, world.seed, 809) * NAME_END.length)]}`,
    center: { x, y },
    outline: [
      { x: minX + cut, y: minY },
      { x: maxX - cut, y: minY },
      { x: maxX, y: minY + cut },
      { x: maxX, y: maxY - cut },
      { x: maxX - cut, y: maxY },
      { x: minX + cut, y: maxY },
      { x: minX, y: maxY - cut },
      { x: minX, y: minY + cut },
    ],
  };
}

/** Reservations guarantee dry usable land, with a bounded earthworks halo. */
export function plannedElevation(world: RegionalWorld, x: number, y: number): number {
  const base = naturalElevation(world, x, y);
  const settlement = settlementForOwner(
    world,
    Math.floor(x / REGION_SIZE),
    Math.floor(y / REGION_SIZE),
  );
  if (!settlement) return base;
  const b = settlement.bounds;
  const outside = Math.max(b.minX - x, x - b.maxX, b.minY - y, y - b.maxY, 0);
  const t = Math.max(0, 1 - outside / 80);
  return Math.max(base, base + (0.18 - base) * t * t * (3 - 2 * t));
}

function pathBounds(points: Point[], width: number): Bounds {
  return {
    minX: Math.min(...points.map((p) => p.x)) - width / 2,
    minY: Math.min(...points.map((p) => p.y)) - width / 2,
    maxX: Math.max(...points.map((p) => p.x)) + width / 2,
    maxY: Math.max(...points.map((p) => p.y)) + width / 2,
  };
}

/** Reject unsupported water crossings. The accepted corridor is a terrain constraint. */
function corridorIsDry(world: RegionalWorld, points: Point[], width: number): boolean {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    const steps = Math.ceil((Math.abs(b.x - a.x) + Math.abs(b.y - a.y)) / 16);
    for (let step = 0; step <= steps; step++) {
      const t = steps === 0 ? 0 : step / steps;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      for (const side of [-width / 2, 0, width / 2]) {
        if (
          plannedElevation(world, x + (a.y !== b.y ? side : 0), y + (a.x !== b.x ? side : 0)) < 0.04
        )
          return false;
      }
    }
  }
  return true;
}

/** East/south edges have one owner. Both endpoints derive exactly the same connection. */
export function connectionForOwner(
  world: RegionalWorld,
  cx: number,
  cy: number,
  axis: "east" | "south",
): Connection | null {
  const a = settlementForOwner(world, cx, cy);
  const b = settlementForOwner(
    world,
    cx + (axis === "east" ? 1 : 0),
    cy + (axis === "south" ? 1 : 0),
  );
  if (!a || !b) return null;
  const width = 16;
  const horizontalFirst = hash(cx, cy, world.seed, axis === "east" ? 907 : 1009) < 0.5;
  for (const horizontal of [horizontalFirst, !horizontalFirst]) {
    const points = [
      a.center,
      horizontal ? { x: b.center.x, y: a.center.y } : { x: a.center.x, y: b.center.y },
      b.center,
    ];
    if (!corridorIsDry(world, points, width)) continue;
    return {
      id: `connection:${cx}:${cy}:${axis}`,
      parentId: `region:${cx}:${cy}`,
      owner: { cx, cy },
      bounds: pathBounds(points, width),
      kind: "connection",
      settlementIds: [a.id, b.id],
      points,
      width,
    };
  }
  return null;
}

export function validateRequest(request: RegionalRequest): void {
  const b = request.bounds;
  if (
    ![b.minX, b.minY, b.maxX, b.maxY].every(
      (v) => Number.isFinite(v) && Math.abs(v) <= MAX_WORLD_COORDINATE,
    ) ||
    b.minX >= b.maxX ||
    b.minY >= b.maxY
  ) {
    throw new Error(
      "Query bounds must be finite, nonempty, and within the supported tile coordinates.",
    );
  }
  if (request.detail !== "region" && request.detail !== "overview")
    throw new Error("Unsupported detail level.");
  if (
    !Number.isFinite(request.sampleStep) ||
    request.sampleStep <= 0 ||
    request.sampleStep > MAX_WORLD_COORDINATE * 2
  )
    throw new Error("Sample step must be positive.");
  for (const key of ["maxSamples", "maxOwners", "maxFeatures"] as const) {
    const value = request.limits[key];
    if (!Number.isInteger(value) || value < 4 || value > QUERY_LIMITS[key])
      throw new Error(`Invalid ${key} budget.`);
  }
}

export function makeGrid(
  bounds: Bounds,
  sampleStep: number,
  maxSamples: number,
): RegionalResult["grid"] {
  let step = 2 ** Math.ceil(Math.log2(Math.max(4, sampleStep)));
  while (true) {
    const x = Math.floor(bounds.minX / step) * step;
    const y = Math.floor(bounds.minY / step) * step;
    const width = Math.ceil((bounds.maxX - x) / step);
    const height = Math.ceil((bounds.maxY - y) / step);
    if (width * height <= maxSamples) return { x, y, step, width, height };
    step *= 2;
  }
}

/**
 * Cooperative steps are rows and owners. Workers yield between steps; tests may
 * drive this synchronously. Budget exhaustion coarsens delivery, never features.
 * Overview performs direct fixed-budget samples and does not enumerate settlements.
 */
export function* regionalQuerySteps(
  world: RegionalWorld,
  request: RegionalRequest,
): Generator<void, RegionalResult> {
  validateWorld(world);
  validateRequest(request);
  const grid = makeGrid(request.bounds, request.sampleStep, request.limits.maxSamples);
  const count = grid.width * grid.height;
  const elevation = new Float32Array(count);
  const moisture = new Float32Array(count);
  const cover = new Uint8Array(count);
  for (let row = 0; row < grid.height; row++) {
    for (let col = 0; col < grid.width; col++) {
      const x = grid.x + (col + 0.5) * grid.step;
      const y = grid.y + (row + 0.5) * grid.step;
      const index = row * grid.width + col;
      const e = plannedElevation(world, x, y);
      const m = plannedMoisture(world, x, y);
      elevation[index] = e;
      moisture[index] = m;
      cover[index] =
        regionalTerrainForElevation(e) <= TerrainId.ShallowWater
          ? LandCover.Water
          : regionalTerrainForElevation(e) <= TerrainId.SandLight
            ? LandCover.Shore
            : m > 0.02
              ? LandCover.Woodland
              : m < -0.16
                ? LandCover.Rural
                : LandCover.Meadow;
    }
    yield;
  }

  // A fixed one-cell halo includes long edges owned outside the queried window.
  const minCx = Math.floor(request.bounds.minX / REGION_SIZE) - 1;
  const minCy = Math.floor(request.bounds.minY / REGION_SIZE) - 1;
  const maxCx = Math.ceil(request.bounds.maxX / REGION_SIZE);
  const maxCy = Math.ceil(request.bounds.maxY / REGION_SIZE);
  const ownerCount = (maxCx - minCx + 1) * (maxCy - minCy + 1);
  const detail =
    request.detail === "region" &&
    ownerCount <= request.limits.maxOwners &&
    ownerCount * 3 <= request.limits.maxFeatures
      ? "region"
      : "overview";
  const settlements: Settlement[] = [];
  const connections: Connection[] = [];
  if (detail === "region") {
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const settlement = settlementForOwner(world, cx, cy);
        if (settlement && intersects(settlement.bounds, request.bounds))
          settlements.push(settlement);
        for (const axis of ["east", "south"] as const) {
          const connection = connectionForOwner(world, cx, cy, axis);
          if (connection && intersects(connection.bounds, request.bounds))
            connections.push(connection);
        }
        yield;
      }
    }
  }
  return {
    world,
    bounds: request.bounds,
    detail,
    grid,
    elevation,
    moisture,
    cover,
    settlements,
    connections,
    stats: {
      samples: count,
      owners: detail === "region" ? ownerCount : 0,
      features: settlements.length + connections.length,
      detailedChunks: 0,
    },
  };
}

export function queryRegion(world: RegionalWorld, request: RegionalRequest): RegionalResult {
  const query = regionalQuerySteps(world, request);
  let step = query.next();
  while (!step.done) step = query.next();
  return step.value;
}

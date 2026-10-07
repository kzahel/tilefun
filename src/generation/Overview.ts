import { TerrainId } from "../autotile/TerrainId.js";
import { type RailLine, RailwayPlanner } from "../railway/RailwayPlanner.js";
import {
  createDescriptor,
  type GenerationDescriptor,
  requireCurrentGeneration,
  resolveDescriptor,
} from "./GenerationDescriptor.js";
import { OnionStrategy } from "./OnionStrategy.js";
import type { CountryPlan } from "./regional/CountrysidePlanner.js";
import { DenseDistrictSource } from "./regional/DenseDistrictPlanner.js";
import type { DistrictPlan } from "./regional/DistrictPlanner.js";
import {
  DEFAULT_LANDSCAPE_PROFILE,
  type LandscapeProfile,
  NaturalLandscape,
  type NaturalPond,
  naturalHabitat,
} from "./regional/NaturalLandscape.js";
import {
  LandCover,
  makeGrid,
  type RegionalRequest,
  type RegionalResult,
  regionalQuerySteps,
  validateRequest,
} from "./regional/RegionalPlanner.js";
import { type RegionalWorld, regionalWorld, validateWorld } from "./regional/WorldDescriptor.js";

export type OverviewResult = Omit<RegionalResult, "world"> & {
  world: GenerationDescriptor | RegionalWorld;
  districts?: DistrictPlan[];
  countryside?: CountryPlan[];
  /** Current generated routes; station coordinates are tiles, optional paths are world pixels. */
  railways?: RailLine[];
  landscape?: LandscapeProfile;
  ponds?: NaturalPond[];
};
export function normalizeGeneration(
  world: GenerationDescriptor | RegionalWorld,
): GenerationDescriptor {
  if ("type" in world) return resolveDescriptor(world);
  validateWorld(world);
  return createDescriptor("regional", world.seed);
}

/** Cheap world queries never realize chunks; all terrain classes use production samplers. */
export function* overviewSteps(
  input: GenerationDescriptor | RegionalWorld,
  request: RegionalRequest,
  landscape?: LandscapeProfile,
): Generator<void, OverviewResult> {
  const descriptor = requireCurrentGeneration(normalizeGeneration(input));
  if (descriptor.type === "regional") {
    landscape ??= DEFAULT_LANDSCAPE_PROFILE;
    const result = yield* regionalQuerySteps(regionalWorld(descriptor.seed), request);
    let railways: RailLine[] = [];
    if (result.detail === "region") {
      const lines = yield* new RailwayPlanner(regionalWorld(descriptor.seed)).querySteps(
        request.bounds,
        request.limits.maxOwners,
      );
      const count = lines.reduce((n, line) => n + 1 + line.stations.length, 0);
      // Keep an entire layer within budget rather than returning a shifting subset.
      if (result.stats.features + count <= request.limits.maxFeatures) {
        railways = lines;
        result.stats.features += count;
      }
    }
    const source = new DenseDistrictSource(regionalWorld(descriptor.seed), true);
    const districts: DistrictPlan[] = [];
    if (result.detail === "region" && result.grid.step <= 16) {
      let features = result.stats.features;
      for (const settlement of result.settlements) {
        const plan = source.owner(settlement.owner.cx, settlement.owner.cy);
        if (!plan) continue;
        const count =
          plan.streets.length +
          plan.blocks.length +
          plan.blocks.reduce((n, block) => n + block.lots.length, 0) +
          (plan.actors?.length ?? 0);
        if (features + count > request.limits.maxFeatures) break;
        districts.push(plan);
        features += count;
        yield;
      }
    }
    result.stats.features += districts.reduce(
      (n, plan) =>
        n +
        plan.streets.length +
        plan.blocks.length +
        plan.blocks.reduce((v, block) => v + block.lots.length, 0) +
        (plan.actors?.length ?? 0),
      0,
    );
    const countryside: CountryPlan[] = [];
    const ponds: NaturalPond[] = [];
    if (landscape) {
      const world = regionalWorld(descriptor.seed);
      const nature = new NaturalLandscape(world, landscape);
      for (let row = 0; row < result.grid.height; row++) {
        for (let col = 0; col < result.grid.width; col++) {
          const i = row * result.grid.width + col;
          const x = result.grid.x + (col + 0.5) * result.grid.step;
          const y = result.grid.y + (row + 0.5) * result.grid.step;
          const precise = result.detail === "region" && result.grid.step <= 32;
          const sample = precise ? nature.sample(x, y) : undefined;
          if (sample && sample.terrain <= TerrainId.ShallowWater) {
            result.cover[i] = LandCover.Water;
            result.elevation[i] = -0.2;
          } else if (sample && sample.terrain <= TerrainId.SandLight) {
            result.cover[i] = LandCover.Shore;
          } else if (result.cover[i] !== LandCover.Water && result.cover[i] !== LandCover.Shore) {
            const habitat = sample ?? naturalHabitat(world, landscape, x, y);
            result.cover[i] = sample?.reserved
              ? LandCover.Meadow
              : sample?.thicket
                ? LandCover.Thicket
                : habitat.habitat === "forest"
                  ? LandCover.DenseWoodland
                  : habitat.habitat === "grove"
                    ? LandCover.Woodland
                    : LandCover.Meadow;
          }
        }
        yield;
      }
      const b = request.bounds;
      const minX = Math.floor(b.minX / 128),
        maxX = Math.floor(b.maxX / 128);
      const minY = Math.floor(b.minY / 128),
        maxY = Math.floor(b.maxY / 128);
      if (result.detail === "region" && (maxX - minX + 1) * (maxY - minY + 1) <= 144) {
        for (let cy = minY; cy <= maxY; cy++) {
          for (let cx = minX; cx <= maxX; cx++) {
            const pond = nature.pond(cx, cy);
            if (pond) ponds.push(pond);
          }
          yield;
        }
      }
      if (result.stats.features + ponds.length > request.limits.maxFeatures) ponds.length = 0;
      result.stats.features += ponds.length;
    }
    return {
      ...result,
      world: descriptor,
      districts,
      countryside,
      railways,
      ...(landscape ? { landscape, ponds } : {}),
    };
  }
  validateRequest(request);
  const grid = makeGrid(request.bounds, request.sampleStep, request.limits.maxSamples);
  const count = grid.width * grid.height;
  const elevation = new Float32Array(count);
  const moisture = new Float32Array(count);
  const cover = new Uint8Array(count);
  const sampler =
    descriptor.type === "classic"
      ? new OnionStrategy(
          descriptor.seed,
          descriptor.preset === "island" ? 12 : 0,
          descriptor.roads,
        )
      : null;
  for (let row = 0; row < grid.height; row++) {
    for (let col = 0; col < grid.width; col++) {
      const x = grid.x + (col + 0.5) * grid.step;
      const y = grid.y + (row + 0.5) * grid.step;
      const terrain = sampler?.sampleTerrain(x, y) ?? TerrainId.Grass;
      const i = row * grid.width + col;
      elevation[i] = terrain <= TerrainId.ShallowWater ? -0.2 : 0.2;
      cover[i] =
        terrain <= TerrainId.ShallowWater
          ? LandCover.Water
          : terrain <= TerrainId.SandLight
            ? LandCover.Shore
            : LandCover.Meadow;
    }
    yield;
  }
  return {
    world: descriptor,
    bounds: request.bounds,
    detail: "overview",
    grid,
    elevation,
    moisture,
    cover,
    settlements: [],
    connections: [],
    railways: [],
    stats: { samples: count, owners: 0, features: 0, detailedChunks: 0 },
  };
}

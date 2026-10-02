import { TerrainId } from "../autotile/TerrainId.js";
import { type GenerationDescriptor, resolveDescriptor } from "./GenerationDescriptor.js";
import { OnionStrategy } from "./OnionStrategy.js";
import { CityPlacesSource } from "./regional/CityPlacesPlanner.js";
import { CommercialDistrictSource } from "./regional/CommercialDistrictPlanner.js";
import { type CountryPlan, CountrySource } from "./regional/CountrysidePlanner.js";
import { DenseDistrictSource } from "./regional/DenseDistrictPlanner.js";
import type { DistrictPlan } from "./regional/DistrictPlanner.js";
import { DistrictSource } from "./regional/DistrictStrategy.js";
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
};
export function normalizeGeneration(
  world: GenerationDescriptor | RegionalWorld,
): GenerationDescriptor {
  if ("type" in world) return resolveDescriptor(world);
  validateWorld(world);
  return resolveDescriptor({
    type: "regional",
    version: "regional-v1",
    seed: world.seed,
    preset: "temperate-v1",
  });
}

/** Cheap world queries never realize chunks; all terrain classes use production samplers. */
export function* overviewSteps(
  input: GenerationDescriptor | RegionalWorld,
  request: RegionalRequest,
): Generator<void, OverviewResult> {
  const descriptor = normalizeGeneration(input);
  if (descriptor.type === "regional") {
    const result = yield* regionalQuerySteps(regionalWorld(descriptor.seed), request);
    const source =
      descriptor.version === "regional-v8"
        ? new CityPlacesSource(regionalWorld(descriptor.seed), 8)
        : descriptor.version === "regional-v7"
          ? new CityPlacesSource(regionalWorld(descriptor.seed), 7)
          : descriptor.version === "regional-v6"
            ? new CommercialDistrictSource(regionalWorld(descriptor.seed))
            : descriptor.version === "regional-v4" || descriptor.version === "regional-v5"
              ? new DenseDistrictSource(
                  regionalWorld(descriptor.seed),
                  descriptor.version === "regional-v5",
                )
              : new DistrictSource(
                  regionalWorld(descriptor.seed),
                  descriptor.version === "regional-v3",
                );
    const districts: DistrictPlan[] = [];
    if (
      descriptor.version !== "regional-v1" &&
      result.detail === "region" &&
      result.grid.step <= 16
    ) {
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
    if (
      descriptor.version === "regional-v3" &&
      result.detail === "region" &&
      result.grid.step <= 16
    ) {
      for (const plan of new CountrySource(regionalWorld(descriptor.seed)).query(request.bounds)) {
        const count = 1 + plan.paths.length + plan.props.length + plan.actors.length;
        if (result.stats.features + count > request.limits.maxFeatures) break;
        countryside.push(plan);
        result.stats.features += count;
        yield;
      }
    }
    return { ...result, world: descriptor, districts, countryside };
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
    stats: { samples: count, owners: 0, features: 0, detailedChunks: 0 },
  };
}

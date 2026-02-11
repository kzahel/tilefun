import type { NoiseMap } from "./NoiseMap.js";

export enum BiomeId {
  DeepWater = 0,
  ShallowWater = 1,
  Sand = 2,
  Grass = 3,
  Forest = 4,
  DenseForest = 5,
}

/**
 * Elevation + moisture thresholds for biome classification.
 * Elevation determines water/land split, moisture determines vegetation density.
 * Grass blends directly into water via ME autotile sheet #15.
 * Sand is a dry inland biome (low moisture).
 */
const ELEVATION_DEEP_WATER = 0.3;
const ELEVATION_SHALLOW_WATER = 0.42;

const MOISTURE_SAND = 0.3;
const MOISTURE_FOREST = 0.5;
const MOISTURE_DENSE_FOREST = 0.65;

/**
 * Maps dual-noise values (elevation + moisture) to a BiomeId
 * using a threshold table.
 */
export class BiomeMapper {
  constructor(
    private readonly elevation: NoiseMap,
    private readonly moisture: NoiseMap,
  ) {}

  /** Get the biome for a world-tile coordinate. */
  getBiome(tx: number, ty: number): BiomeId {
    const e = this.elevation.sample(tx, ty);
    const m = this.moisture.sample(tx, ty);
    return BiomeMapper.classify(e, m);
  }

  /** Pure classification from elevation/moisture values. Useful for testing. */
  static classify(elevation: number, moisture: number): BiomeId {
    if (elevation < ELEVATION_DEEP_WATER) return BiomeId.DeepWater;
    if (elevation < ELEVATION_SHALLOW_WATER) return BiomeId.ShallowWater;
    // Land biomes: moisture determines vegetation
    if (moisture < MOISTURE_SAND) return BiomeId.Sand;
    if (moisture < MOISTURE_FOREST) return BiomeId.Grass;
    if (moisture < MOISTURE_DENSE_FOREST) return BiomeId.Forest;
    return BiomeId.DenseForest;
  }
}

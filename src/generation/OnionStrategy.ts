import { TerrainId } from "../autotile/TerrainId.js";
import { CHUNK_SIZE } from "../config/constants.js";
import { Chunk } from "../world/Chunk.js";
import { deriveTerrain } from "./deriveTerrain.js";
import { fbm } from "./noise.js";
import { generateChunkRoads, type RoadGenParams } from "./RoadGenerator.js";
import type { TerrainStrategy } from "./TerrainStrategy.js";

/** Controls feature size — lower = larger features. ~0.012 gives ~5-chunk-wide features. */
const NOISE_SCALE = 0.012;

/**
 * Elevation bands mapped to the 5-terrain chain.
 * Every adjacent pair has a dedicated blend sheet, so transitions are always clean.
 */
const BANDS: [number, TerrainId][] = [
  [-0.35, TerrainId.DeepWater],
  [-0.15, TerrainId.ShallowWater],
  [0.05, TerrainId.Sand],
  [0.2, TerrainId.SandLight],
];
const DEFAULT_TERRAIN = TerrainId.Grass;

function elevationToTerrain(elevation: number): TerrainId {
  for (const [threshold, terrain] of BANDS) {
    if (elevation < threshold) return terrain;
  }
  return DEFAULT_TERRAIN;
}

/**
 * Generates terrain using noise-based elevation bands.
 * Produces natural-looking landscapes with water, beaches, and grasslands
 * using only the 5-terrain chain that has dedicated autotile blend sheets.
 *
 * Island mode: fades elevation toward deep water beyond a small radius,
 * producing a small island surrounded by ocean.
 */
export class OnionStrategy implements TerrainStrategy {
  constructor(
    private readonly seed = 42,
    /** Radius in tiles for island mode. 0 = normal generation (no island). */
    private readonly islandRadius = 0,
    /** Road generation params. Undefined = no roads. */
    private readonly roadParams?: RoadGenParams,
  ) {}

  sampleTerrain(wx: number, wy: number): TerrainId {
    const elevation =
      this.islandRadius > 0
        ? 1 - (2 * Math.sqrt(wx * wx + wy * wy)) / this.islandRadius
        : fbm(wx * NOISE_SCALE, wy * NOISE_SCALE, this.seed, 3);
    return elevationToTerrain(elevation);
  }

  generate(chunk: Chunk, cx: number, cy: number): void {
    const SG = Chunk.SUBGRID_SIZE; // 33

    // Fill subgrid from elevation
    for (let sy = 0; sy < SG; sy++) {
      for (let sx = 0; sx < SG; sx++) {
        const wx = cx * CHUNK_SIZE + sx / 2;
        const wy = cy * CHUNK_SIZE + sy / 2;
        chunk.setSubgrid(sx, sy, this.sampleTerrain(wx, wy));
      }
    }

    deriveTerrain(chunk);

    if (this.roadParams) {
      generateChunkRoads(chunk, cx, cy, this.seed, this.roadParams, this.islandRadius);
    }
  }
}

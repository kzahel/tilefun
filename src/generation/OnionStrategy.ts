import { TerrainId } from "../autotile/TerrainId.js";
import { CHUNK_SIZE } from "../config/constants.js";
import { Chunk } from "../world/Chunk.js";
import { getCollisionForWaterTile, TileId, terrainIdToTileId } from "../world/TileRegistry.js";
import { fbm } from "./noise.js";
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
  ) {}

  generate(chunk: Chunk, cx: number, cy: number): void {
    const SG = Chunk.SUBGRID_SIZE; // 33

    // Fill subgrid from elevation
    for (let sy = 0; sy < SG; sy++) {
      for (let sx = 0; sx < SG; sx++) {
        const wx = cx * CHUNK_SIZE + sx / 2;
        const wy = cy * CHUNK_SIZE + sy / 2;
        let elevation: number;

        if (this.islandRadius > 0) {
          // Island mode: simple concentric rings, no noise — always deterministic
          const dist = Math.sqrt(wx * wx + wy * wy);
          // Map distance to elevation: center=1, edge of island=0, beyond=-1
          elevation = 1 - (2 * dist) / this.islandRadius;
        } else {
          elevation = fbm(wx * NOISE_SCALE, wy * NOISE_SCALE, this.seed, 3);
        }

        chunk.setSubgrid(sx, sy, elevationToTerrain(elevation));
      }
    }

    // Derive terrain tiles and collision from subgrid centers
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const terrain = chunk.getSubgrid(lx * 2 + 1, ly * 2 + 1);
        const tileId = terrainIdToTileId(terrain);
        chunk.setTerrain(lx, ly, tileId);

        // Count water subgrid points in 3x3 area for collision threshold
        let waterCount = 0;
        const scx = lx * 2 + 1;
        const scy = ly * 2 + 1;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const tid = terrainIdToTileId(chunk.getSubgrid(scx + dx, scy + dy));
            if (tid === TileId.Water || tid === TileId.DeepWater) waterCount++;
          }
        }
        chunk.setCollision(lx, ly, getCollisionForWaterTile(tileId, waterCount));
      }
    }
  }
}

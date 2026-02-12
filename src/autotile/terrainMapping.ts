import { BiomeId } from "../generation/BiomeMapper.js";
import { TileId } from "../world/TileRegistry.js";
import { TerrainId } from "./TerrainId.js";

/**
 * Map TileId (from any generation strategy) to TerrainId (for the graph renderer).
 * Forest/DenseForest collapse to Grass. DirtPath maps to DirtWarm.
 */
export function tileIdToTerrainId(tileId: TileId): TerrainId {
  switch (tileId) {
    case TileId.DeepWater:
      return TerrainId.DeepWater;
    case TileId.Water:
      return TerrainId.ShallowWater;
    case TileId.Sand:
      return TerrainId.Sand;
    case TileId.Grass:
    case TileId.Forest:
    case TileId.DenseForest:
      return TerrainId.Grass;
    case TileId.DirtPath:
      return TerrainId.DirtWarm;
    default:
      return TerrainId.Grass;
  }
}

/** Map TileId to BiomeId for corner-based editing. */
export function tileIdToBiomeId(tileId: TileId): BiomeId {
  switch (tileId) {
    case TileId.DeepWater:
      return BiomeId.DeepWater;
    case TileId.Water:
      return BiomeId.ShallowWater;
    case TileId.Sand:
      return BiomeId.Sand;
    case TileId.Forest:
      return BiomeId.Forest;
    case TileId.DenseForest:
      return BiomeId.DenseForest;
    default:
      return BiomeId.Grass;
  }
}

/** Map BiomeId back to TileId for terrain derivation from corners. */
export function biomeIdToTileId(biome: BiomeId): TileId {
  switch (biome) {
    case BiomeId.DeepWater:
      return TileId.DeepWater;
    case BiomeId.ShallowWater:
      return TileId.Water;
    case BiomeId.Sand:
      return TileId.Sand;
    case BiomeId.Forest:
      return TileId.Forest;
    case BiomeId.DenseForest:
      return TileId.DenseForest;
    default:
      return TileId.Grass;
  }
}

import { BiomeId } from "../generation/BiomeMapper.js";
import { TileId } from "../world/TileRegistry.js";
import { TerrainId } from "./TerrainId.js";

/**
 * Map TerrainId to TileId for chunk terrain derivation.
 * SandLight maps to Sand, DirtLight/DirtWarm map to DirtPath (no dedicated TileIds).
 */
export function terrainIdToTileId(terrain: TerrainId): TileId {
  switch (terrain) {
    case TerrainId.DeepWater:
      return TileId.DeepWater;
    case TerrainId.ShallowWater:
      return TileId.Water;
    case TerrainId.Sand:
    case TerrainId.SandLight:
      return TileId.Sand;
    case TerrainId.Grass:
      return TileId.Grass;
    case TerrainId.DirtLight:
    case TerrainId.DirtWarm:
      return TileId.DirtPath;
    default:
      return TileId.Grass;
  }
}

/**
 * Map BiomeId to TerrainId. Forest/DenseForest collapse to Grass.
 * CRITICAL: BiomeId.Grass=3 maps to TerrainId.Grass=4, NOT a direct cast.
 */
export function biomeIdToTerrainId(biome: BiomeId): TerrainId {
  switch (biome) {
    case BiomeId.DeepWater:
      return TerrainId.DeepWater;
    case BiomeId.ShallowWater:
      return TerrainId.ShallowWater;
    case BiomeId.Sand:
      return TerrainId.Sand;
    case BiomeId.Grass:
    case BiomeId.Forest:
    case BiomeId.DenseForest:
      return TerrainId.Grass;
    default:
      return TerrainId.Grass;
  }
}

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

/** @legacy Map TileId to BiomeId for corner-based editing. */
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

/** @legacy Map BiomeId back to TileId for terrain derivation from corners. */
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

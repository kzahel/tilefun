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

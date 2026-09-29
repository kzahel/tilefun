import { toBaseTerrainId } from "../autotile/TerrainId.js";
import { CHUNK_SIZE } from "../config/constants.js";
import type { Chunk } from "../world/Chunk.js";
import { getCollisionForWaterTile, TileId, terrainIdToTileId } from "../world/TileRegistry.js";

/** One subgrid-to-tile/collision path for all generators and saved edits. */
export function deriveTerrain(chunk: Chunk): void {
  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const sx = lx * 2 + 1;
      const sy = ly * 2 + 1;
      const tile = terrainIdToTileId(toBaseTerrainId(chunk.getSubgrid(sx, sy)));
      chunk.setTerrain(lx, ly, tile);
      let water = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const neighbor = terrainIdToTileId(toBaseTerrainId(chunk.getSubgrid(sx + dx, sy + dy)));
          if (neighbor === TileId.Water || neighbor === TileId.DeepWater) water++;
        }
      }
      chunk.setCollision(lx, ly, getCollisionForWaterTile(tile, water));
      chunk.setDetail(lx, ly, TileId.Empty);
    }
  }
}

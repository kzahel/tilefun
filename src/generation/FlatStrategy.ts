import { CHUNK_SIZE } from "../config/constants.js";
import type { Chunk } from "../world/Chunk.js";
import { CollisionFlag, TileId } from "../world/TileRegistry.js";
import { BiomeId } from "./BiomeMapper.js";
import type { TerrainStrategy } from "./TerrainStrategy.js";

/**
 * Generates a completely flat grass world.
 * All tiles are Grass, all corners are Grass, no details.
 * Useful for editor testing and isolating terrain editing behavior.
 */
export class FlatStrategy implements TerrainStrategy {
  generate(chunk: Chunk, _cx: number, _cy: number): void {
    chunk.fillTerrain(TileId.Grass);
    chunk.fillCollision(CollisionFlag.None);

    // Set all corners to Grass so corner-based editing starts clean
    const cornerSize = CHUNK_SIZE + 1;
    for (let cy = 0; cy < cornerSize; cy++) {
      for (let cx = 0; cx < cornerSize; cx++) {
        chunk.setCorner(cx, cy, BiomeId.Grass);
      }
    }
  }
}

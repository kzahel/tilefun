import { TerrainId } from "../autotile/TerrainId.js";
import type { Chunk } from "../world/Chunk.js";
import { CollisionFlag, TileId } from "../world/TileRegistry.js";
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

    // Fill entire subgrid with Grass (TerrainId) so editing starts clean
    chunk.subgrid.fill(TerrainId.Grass);
  }
}

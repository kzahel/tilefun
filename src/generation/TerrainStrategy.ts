import type { Chunk } from "../world/Chunk.js";

/** Interface for terrain generation strategies. */
export interface TerrainStrategy {
  generate(chunk: Chunk, cx: number, cy: number): void;
}

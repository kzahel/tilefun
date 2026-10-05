import type { RailPath } from "../railway/RailPath.js";
import type { Chunk } from "../world/Chunk.js";

/** Interface for terrain generation strategies. */
export interface TerrainStrategy {
  generate(chunk: Chunk, cx: number, cy: number): void;
  /** Deterministic geometry, also reconstructed for saved terrain edits. */
  railPathsForChunk?(cx: number, cy: number): RailPath[];
}

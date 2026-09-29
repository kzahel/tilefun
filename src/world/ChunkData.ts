import { Chunk } from "./Chunk.js";

/** Renderer-free buffers shared by worker realization and game hydration. */
export const CHUNK_DATA_FIELDS = [
  "subgrid",
  "terrain",
  "detail",
  "collision",
  "roadGrid",
  "heightGrid",
] as const;
export type ChunkData = Pick<Chunk, (typeof CHUNK_DATA_FIELDS)[number]>;

/** Transfers ownership: call only when the source chunk is no longer needed. */
export function chunkData(chunk: Chunk): ChunkData {
  return {
    subgrid: chunk.subgrid,
    terrain: chunk.terrain,
    detail: chunk.detail,
    collision: chunk.collision,
    roadGrid: chunk.roadGrid,
    heightGrid: chunk.heightGrid,
  };
}
export function chunkDataTransfers(data: ChunkData): ArrayBuffer[] {
  return CHUNK_DATA_FIELDS.map((field) => data[field].buffer as ArrayBuffer);
}
export function hydrateChunk(data: ChunkData): Chunk {
  const chunk = new Chunk();
  for (const field of CHUNK_DATA_FIELDS) {
    if (data[field].length !== chunk[field].length)
      throw new Error(`Invalid chunk ${field} length.`);
    chunk[field].set(data[field]);
  }
  return chunk;
}

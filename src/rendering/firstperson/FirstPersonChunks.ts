import { CHUNK_SIZE_PX } from "../../config/constants.js";

/** What a chunk's ground was built from. */
export interface TerrainEntry {
  readonly chunk: object;
  readonly key: string;
}

/** Ground rebuilds for a replaced chunk object as well as for edited content. */
export function terrainStale(
  cached: TerrainEntry | undefined,
  chunk: { revision: number; visualRevision: number },
): boolean {
  return cached?.chunk !== chunk || cached.key !== `${chunk.revision}:${chunk.visualRevision}`;
}

export function chunkKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

/** Chunk coordinates within `reach` of the eye, nearest first. */
export function chunksInReach(
  x: number,
  y: number,
  reach: number,
): { cx: number; cy: number; key: string; distance: number }[] {
  const wanted: { cx: number; cy: number; key: string; distance: number }[] = [];
  const min = (v: number) => Math.floor((v - reach) / CHUNK_SIZE_PX);
  const max = (v: number) => Math.floor((v + reach) / CHUNK_SIZE_PX);
  for (let cy = min(y); cy <= max(y); cy++)
    for (let cx = min(x); cx <= max(x); cx++) {
      const nx = Math.max(cx * CHUNK_SIZE_PX, Math.min(x, (cx + 1) * CHUNK_SIZE_PX));
      const ny = Math.max(cy * CHUNK_SIZE_PX, Math.min(y, (cy + 1) * CHUNK_SIZE_PX));
      const distance = Math.hypot(nx - x, ny - y);
      if (distance <= reach) wanted.push({ cx, cy, key: chunkKey(cx, cy), distance });
    }
  return wanted.sort((a, b) => a.distance - b.distance);
}

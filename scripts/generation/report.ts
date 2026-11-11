import type { Chunk } from "../../src/world/Chunk.js";

export interface Coordinate {
  cx: number;
  cy: number;
}
export interface Sample extends Coordinate {
  phasesMs: Record<string, number>;
  totalMs: number;
  props: number;
  actors: number;
  gridBytes: number;
  contentHash?: string;
  coordinates?: Coordinate[];
  chunks?: number;
  publications?: (Coordinate & { ms: number })[];
  planProps?: number;
  planActors?: number;
  residentChunks?: number;
}
export const round = (n: number) => Math.round(n * 1000) / 1000;
export function summarize(values: number[]) {
  if (!values.length) throw Error("Cannot summarize an empty sample");
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p: number) => sorted[Math.ceil(sorted.length * p) - 1] ?? 0;
  return {
    count: values.length,
    totalMs: round(values.reduce((a, b) => a + b, 0)),
    p50: round(at(0.5)),
    p95: round(at(0.95)),
    p99: round(at(0.99)),
    max: round(sorted.at(-1) ?? 0),
    over8Ms: values.filter((n) => n > 8).length,
    over16Ms: values.filter((n) => n > 16).length,
  };
}

/** Adjacent chunks in a serpentine square; includes negative-coordinate boundaries. */
export function route(cx: number, cy: number, side: number): Coordinate[] {
  const startX = cx - Math.floor(side / 2),
    startY = cy - Math.floor(side / 2);
  return Array.from({ length: side * side }, (_, i) => {
    const row = Math.floor(i / side),
      col = i % side;
    return { cx: startX + (row % 2 ? side - 1 - col : col), cy: startY + row };
  });
}

export function gridArrays(c: Chunk) {
  return [
    c.subgrid,
    c.roadGrid,
    c.heightGrid,
    c.terrain,
    c.detail,
    c.blendBase,
    c.blendLayers,
    c.collision,
  ];
}

/** Verification is a separate, explicitly labelled run: hashing allocates and changes GC. */
export function contentHash(c: Chunk, props: unknown, actors: unknown) {
  let hash = 2166136261;
  const add = (byte: number) => {
    hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  };
  for (const array of gridArrays(c))
    for (const byte of new Uint8Array(array.buffer, array.byteOffset, array.byteLength)) add(byte);
  for (const byte of new TextEncoder().encode(JSON.stringify([c.railPaths, props, actors])))
    add(byte);
  return hash.toString(16).padStart(8, "0");
}

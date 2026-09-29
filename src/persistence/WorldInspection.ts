import { CHUNK_SIZE, TILE_SIZE } from "../config/constants.js";
import type { GenerationDescriptor } from "../generation/GenerationDescriptor.js";
import { createGenerator } from "../generation/Generator.js";
import type { Bounds } from "../generation/regional/RegionalPlanner.js";
import type { StructurePlacement } from "../generation/StructureGenerator.js";
import type { PersistenceStore } from "./PersistenceStore.js";
import type { SavedMeta, SerializedEntity } from "./SaveManager.js";

export interface InspectionChunk {
  cx: number;
  cy: number;
  subgrid: number[];
  roadGrid: number[];
  heightGrid: number[];
}
export interface InspectionSnapshot {
  generation: GenerationDescriptor;
  chunks: InspectionChunk[];
  deleted: string[];
  props: SerializedEntity[];
  coverage: "live authority" | "saved snapshot";
  capturedAt: string;
}
export function validateInspection(
  coordinates: { cx: number; cy: number }[],
  bounds: Bounds,
): void {
  if (
    coordinates.length > 81 ||
    coordinates.some(
      (c) =>
        !Number.isInteger(c.cx) ||
        !Number.isInteger(c.cy) ||
        Math.abs(c.cx) > 2 ** 19 ||
        Math.abs(c.cy) > 2 ** 19,
    )
  )
    throw new Error("Inspection exceeds its chunk cap.");
  if (
    !Object.values(bounds).every(Number.isFinite) ||
    Object.values(bounds).some((v) => Math.abs(v) > 2 ** 24) ||
    bounds.maxX <= bounds.minX ||
    bounds.maxY <= bounds.minY ||
    bounds.maxX - bounds.minX > 160 ||
    bounds.maxY - bounds.minY > 160
  )
    throw new Error("Inspection exceeds its footprint cap.");
}
export function inspectionPlacements(
  generation: GenerationDescriptor,
  bounds: Bounds,
): StructurePlacement[] {
  validateInspection([], bounds);
  const generator = createGenerator(generation),
    placements = new Map<string, StructurePlacement>();
  const processed = new Set<string>();
  for (
    let cy = Math.floor(bounds.minY / CHUNK_SIZE);
    cy <= Math.floor(bounds.maxY / CHUNK_SIZE);
    cy++
  )
    for (
      let cx = Math.floor(bounds.minX / CHUNK_SIZE);
      cx <= Math.floor(bounds.maxX / CHUNK_SIZE);
      cx++
    ) {
      const result = generator.placements(cx, cy, processed);
      for (const key of result.newIntersectionKeys) processed.add(key);
      for (const p of result.placements) {
        const id = p.featureId ?? `classic:${p.propType}:${p.wx}:${p.wy}`;
        placements.set(id, { ...p, featureId: id });
      }
    }
  if (placements.size > 512) throw new Error("Inspection exceeds its prop cap.");
  return [...placements.values()];
}
export function inspectionOverlays(
  generation: GenerationDescriptor,
  bounds: Bounds,
  meta: SavedMeta | null,
): Pick<InspectionSnapshot, "deleted" | "props"> {
  const candidates = new Set(inspectionPlacements(generation, bounds).map((p) => p.featureId));
  const inBounds = (p: SerializedEntity) =>
    p.wx >= bounds.minX * TILE_SIZE - 320 &&
    p.wx <= bounds.maxX * TILE_SIZE + 320 &&
    p.wy >= bounds.minY * TILE_SIZE - 320 &&
    p.wy <= bounds.maxY * TILE_SIZE + 320;
  const props = [
    ...(meta?.entities ?? []).filter((p) => p.type.startsWith("prop-")),
    ...(meta?.proceduralEdits ?? []),
  ].filter(inBounds);
  const deleted = [
    ...(meta?.deletedProceduralIds ?? []).filter((id) => candidates.has(id)),
    ...(meta?.proceduralEdits ?? [])
      .filter((p) => p.proceduralId && candidates.has(p.proceduralId))
      .map((p) => p.proceduralId ?? ""),
  ];
  if (props.length > 512 || deleted.length > 1024)
    throw new Error("Saved inspection exceeds its prop cap.");
  return { deleted, props };
}
export async function readInspection(
  store: PersistenceStore,
  generation: GenerationDescriptor,
  coordinates: { cx: number; cy: number }[],
  bounds: Bounds,
): Promise<InspectionSnapshot> {
  validateInspection(coordinates, bounds);
  const chunks: InspectionChunk[] = [];
  const meta = (await store.get("meta", "state")) as SavedMeta | null;
  for (const c of coordinates) {
    const raw = (await store.get("chunks", `${c.cx},${c.cy}`)) as
      | { subgrid?: ArrayBuffer; roadGrid?: ArrayBuffer; heightGrid?: ArrayBuffer }
      | undefined;
    if (raw?.subgrid)
      chunks.push({
        ...c,
        subgrid: Array.from(new Uint8Array(raw.subgrid)),
        roadGrid: raw.roadGrid ? Array.from(new Uint8Array(raw.roadGrid)) : Array(256).fill(0),
        heightGrid: raw.heightGrid
          ? Array.from(new Uint8Array(raw.heightGrid))
          : Array(256).fill(0),
      });
  }
  return {
    generation,
    chunks,
    ...inspectionOverlays(generation, bounds, meta),
    coverage: "saved snapshot",
    capturedAt: new Date().toISOString(),
  };
}

import { CHUNK_SIZE, TILE_SIZE } from "../config/constants.js";
import { actorPlacements } from "../generation/ActorPlacements.js";
import type { GenerationDescriptor } from "../generation/GenerationDescriptor.js";
import { createGenerator } from "../generation/Generator.js";
import type { Bounds } from "../generation/regional/RegionalPlanner.js";
import type { StructurePlacement } from "../generation/StructureGenerator.js";
import type { ActorRecord } from "./ActorRecords.js";
import type { PersistenceStore } from "./PersistenceStore.js";
import type { FeatureRecord } from "./RealmRecords.js";
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
  actors?: SerializedEntity[];
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
): Pick<InspectionSnapshot, "deleted" | "props" | "actors"> {
  const candidates = new Set(inspectionPlacements(generation, bounds).map((p) => p.featureId));
  for (const a of actorPlacements(createGenerator(generation), bounds)) candidates.add(a.featureId);
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
  const actors = (meta?.entities ?? [])
    .filter((p) => !p.type.startsWith("prop-") && p.type !== "player")
    .filter(inBounds);
  if (actors.length > 128) throw new Error("Saved inspection exceeds its actor cap.");
  return { deleted, props, actors };
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
  const entities: SerializedEntity[] = [];
  const deletedProceduralIds: string[] = [];
  const proceduralEdits: SerializedEntity[] = [];
  for (
    let cy = Math.floor(bounds.minY / CHUNK_SIZE) - 2;
    cy <= Math.floor(bounds.maxY / CHUNK_SIZE) + 2;
    cy++
  ) {
    for (
      let cx = Math.floor(bounds.minX / CHUNK_SIZE) - 2;
      cx <= Math.floor(bounds.maxX / CHUNK_SIZE) + 2;
      cx++
    ) {
      for (const collection of ["entities", "props", "features"]) {
        const page = await store.scan(collection, `${cx},${cy}`, undefined, 1024);
        if (page.size === 1024) throw new Error("Saved inspection exceeds its record cap.");
        for (const value of page.values()) {
          if (collection === "features") {
            const feature = value as FeatureRecord;
            if (feature.deleted) deletedProceduralIds.push(feature.id);
            if (feature.edit) proceduralEdits.push(feature.edit);
          } else {
            const actor = value as ActorRecord;
            // Edited generated props are represented once, at their destination.
            entities.push({
              type: actor.type,
              wx: actor.wx,
              wy: actor.wy,
              ...(actor.proceduralId ? { proceduralId: actor.proceduralId } : {}),
            });
          }
        }
      }
    }
  }
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
    ...inspectionOverlays(generation, bounds, {
      ...meta,
      entities,
      deletedProceduralIds,
      proceduralEdits: proceduralEdits.filter(
        (edit) => !entities.some((e) => e.proceduralId === edit.proceduralId),
      ),
      playerX: meta?.playerX ?? 0,
      playerY: meta?.playerY ?? 0,
      cameraX: meta?.cameraX ?? 0,
      cameraY: meta?.cameraY ?? 0,
      cameraZoom: meta?.cameraZoom ?? 1,
    }),
    coverage: "saved snapshot",
    capturedAt: new Date().toISOString(),
  };
}

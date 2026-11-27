import { CHUNK_SIZE_PX } from "../../config/constants.js";
import type { Chunk } from "../../world/Chunk.js";
import { deriveTerrain } from "../deriveTerrain.js";
import type { DenseDistrictSource } from "./DenseDistrictSource.js";
import { type LeisurePlace, leisureTerrain } from "./LeisurePlaces.js";
import type { NaturalLandscape } from "./NaturalLandscape.js";
import type { Bounds } from "./RegionalPlanner.js";
import { intersectingPlacements } from "./VehicleDepotPlanner.js";

export const inActorChunk = (cx: number, cy: number) => (p: { wx: number; wy: number }) =>
  Math.floor(p.wx / CHUNK_SIZE_PX) === cx && Math.floor(p.wy / CHUNK_SIZE_PX) === cy;

export function outingActors(
  nature: NaturalLandscape,
  districts: DenseDistrictSource,
  cx: number,
  cy: number,
  bounds: Bounds,
) {
  const balls = districts
    .query(bounds)
    .filter((p) => (p.playYard ?? 0) >= 0.72)
    .map((p) => ({
      featureId: `${p.id}:play:ball`,
      type: "ball",
      route: [],
      wx: ((p.park.minX + p.park.maxX) / 2 - 6) * 16,
      wy: ((p.park.minY + p.park.maxY) / 2 - 2) * 16,
    }));
  return [...balls, ...nature.leisure(bounds).flatMap((p) => p.actors)].filter(
    inActorChunk(cx, cy),
  );
}
export function outingProps(nature: NaturalLandscape, b: Bounds) {
  const visible = { minX: b.minX - 8, minY: b.minY - 1, maxX: b.maxX + 8, maxY: b.maxY + 12 };
  return nature.leisure(visible).flatMap((p) => intersectingPlacements(p.props, b));
}
export function finishOutingTerrain(
  chunk: Chunk,
  cx: number,
  cy: number,
  places: readonly LeisurePlace[],
  changed: boolean,
) {
  for (const p of places) {
    const x0 = Math.max(0, (p.bounds.minX - cx * 16) * 2),
      y0 = Math.max(0, (p.bounds.minY - cy * 16) * 2);
    const x1 = Math.min(32, (p.bounds.maxX - cx * 16) * 2),
      y1 = Math.min(32, (p.bounds.maxY - cy * 16) * 2);
    for (let sy = y0; sy <= y1; sy++)
      for (let sx = x0; sx <= x1; sx++) {
        const terrain = leisureTerrain(p, cx * 16 + sx / 2, cy * 16 + sy / 2);
        if (terrain === undefined) continue;
        chunk.setSubgrid(sx, sy, terrain);
        if (sx < 32 && sy < 32 && sx % 2 === 0 && sy % 2 === 0) chunk.setHeight(sx / 2, sy / 2, 0);
        changed = true;
      }
  }
  if (changed) deriveTerrain(chunk);
}

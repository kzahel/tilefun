import {
  COMMERCIAL_CITY_ASSETS as bank,
  COMMERCIAL_SURFACE_CELLS,
} from "../generation/regional/CommercialCityAssets.js";
import { cityRoundedTileAt, type SurfacePiece } from "./CitySurfaceRecipes.js";
import { surfaceCell, surfaceCellKey } from "./SurfaceCells.js";

const indices = new Map(
  COMMERCIAL_SURFACE_CELLS.map((p, i) => [surfaceCellKey(p), i + bank.roadStart]),
);
export function isCommercialSurface(type: number) {
  return type >= bank.roadStart && type < bank.roadStart + COMMERCIAL_SURFACE_CELLS.length;
}
export function commercialSurfacePieces(type: number, x: number, y: number): SurfacePiece[] {
  return (COMMERCIAL_SURFACE_CELLS[type - bank.roadStart] ?? []).map((p) => ({
    ...p,
    x: p.x + x * 16,
    y: p.y + y * 16,
  }));
}
/** Persist the exact source cell, rather than recalculating its art from mutable
 * review recipes after a world has been saved or a neighboring chunk unloaded. */
export function commercialSurfaceAt(
  x: number,
  y: number,
  road: (x: number, y: number) => boolean,
  overlays: readonly SurfacePiece[],
): number {
  let mask = 0;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) if (road(x + dx, y + dy)) mask |= 1 << ((dy + 1) * 3 + dx + 1);
  const neutral = COMMERCIAL_SURFACE_CELLS[bank.neutral[mask] ?? -1];
  if (!neutral) throw new Error("Missing promoted surface cell");
  const corner = cityRoundedTileAt(x, y, road, bank.corners as [number, number, number, number][]);
  const base = corner ? [corner] : neutral.map((p) => ({ ...p, x: p.x + x * 16, y: p.y + y * 16 }));
  const pieces = surfaceCell([...base, ...overlays], x, y),
    id = indices.get(surfaceCellKey(pieces));
  if (id === undefined)
    throw new Error(`Unpromoted commercial surface at ${x},${y}: ${surfaceCellKey(pieces)}`);
  return id;
}

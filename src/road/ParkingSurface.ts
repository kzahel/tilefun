import { parkingLayout } from "../generation/regional/ParkingLayout.js";
import type { SurfacePiece } from "./CitySurfaceRecipes.js";
import { RoadType } from "./RoadType.js";
import { surfaceCell, surfaceCellKey } from "./SurfaceCells.js";

// Like commercial city surfaces, save the selected source cell in roadGrid.
// These are current, unpromoted generation cells; existing road IDs stay fixed.
const layout = parkingLayout("shopping");
const ground = layout.pieces.filter((p) => p.layer === "terrain");
const cells: { pieces: SurfacePiece[]; road: boolean }[] = [];
const indices = new Map<string, number>();
const grid: number[] = [];
const columns = layout.width / 16;
const clipped: SurfacePiece[][] = Array.from({ length: columns * (layout.height / 16) }, () => []);
for (const p of ground)
  for (
    let y = Math.max(0, Math.floor(p.y / 16));
    y < Math.min(layout.height / 16, Math.ceil((p.y + p.rect[3]) / 16));
    y++
  )
    for (
      let x = Math.max(0, Math.floor(p.x / 16));
      x < Math.min(columns, Math.ceil((p.x + p.rect[2]) / 16));
      x++
    )
      clipped[y * columns + x]?.push(...surfaceCell([p], x, y));
for (let y = 0; y < layout.height / 16; y++)
  for (let x = 0; x < layout.width / 16; x++) {
    // Preserve transparent paint/curb layers; do not discard their ground fill.
    const pieces = clipped[y * columns + x] ?? [];
    const road = pieces[0]?.role !== "pavement";
    const key = `${road}:${surfaceCellKey(pieces)}`;
    let id = indices.get(key);
    if (id === undefined) {
      id = RoadType.ParkingStart + cells.length;
      if (id > 255) throw Error("Parking surfaces exceed the saved road-grid range");
      indices.set(key, id);
      cells.push({ pieces, road });
    }
    grid.push(id);
  }
export const PARKING_SURFACE_COUNT = cells.length;
export function isParkingSurface(type: number): boolean {
  return type >= RoadType.ParkingStart && type < RoadType.ParkingStart + cells.length;
}
export function isParkingRoad(type: number): boolean {
  return cells[type - RoadType.ParkingStart]?.road ?? false;
}
export function parkingSurfaceAt(x: number, y: number): number {
  if (x < 0 || y < 0 || x >= columns || y >= layout.height / 16) return RoadType.None;
  return grid[y * columns + x] ?? RoadType.None;
}
export function parkingSurfacePieces(type: number, x: number, y: number): SurfacePiece[] {
  return (cells[type - RoadType.ParkingStart]?.pieces ?? []).map((p) => ({
    ...p,
    x: p.x + x * 16,
    y: p.y + y * 16,
  }));
}

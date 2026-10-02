import { TILE_SIZE } from "../config/constants.js";
import type { StreetRect } from "../generation/regional/StreetRecipes.js";
import type { SurfacePiece } from "./CitySurfaceRecipes.js";
import { denseCitySurfacePieces } from "./DenseCitySurface.js";
import { RoadType } from "./RoadType.js";

/** Furniture-stage geometry in native pixels; art comes from the same pinned
 * surface composer as dense neighborhoods. Query beyond the view so cropping
 * cannot introduce curb end caps.
 */
export const STREET_STARTER_SURFACE = {
  recipe: "street-starter-surfaces-v1",
  pavementTop: 0,
  curbY: 96,
  bank: "city-surfaces-v1",
} as const;

export function composeStreetStarterSurface(bounds: StreetRect): SurfacePiece[] {
  const pieces: SurfacePiece[] = [];
  const query = (_x: number, y: number) =>
    y * TILE_SIZE >= STREET_STARTER_SURFACE.curbY ? RoadType.CityAsphalt : RoadType.CityPavement;
  for (
    let y = Math.max(
      Math.floor(bounds.minY / TILE_SIZE),
      STREET_STARTER_SURFACE.pavementTop / TILE_SIZE,
    );
    y < Math.ceil(bounds.maxY / TILE_SIZE);
    y++
  )
    for (let x = Math.floor(bounds.minX / TILE_SIZE); x < Math.ceil(bounds.maxX / TILE_SIZE); x++)
      pieces.push(...denseCitySurfacePieces(query(x, y), x, y, query));
  return pieces;
}

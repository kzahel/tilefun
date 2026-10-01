import { citySurfaceTileAt, type SurfacePiece } from "./CitySurfaceRecipes.js";
import { isRoad, RoadType } from "./RoadType.js";

/** These persistent roadGrid values belong to the immutable city-surfaces-v1
 * realization used by regional-v4. Later art changes need a new bank/version.
 */
export function isCitySurface(type: number): boolean {
  return type >= RoadType.CityAsphalt && type <= RoadType.CityCrossVBottom;
}
export function isCityRoad(type: number): boolean {
  return isRoad(type) && type !== RoadType.Sidewalk && type !== RoadType.CityPavement;
}
export function denseCitySurfacePieces(
  type: RoadType,
  x: number,
  y: number,
  query: (x: number, y: number) => number,
): SurfacePiece[] {
  const base = citySurfaceTileAt("neutral", x, y, (x, y) => isCityRoad(query(x, y)));
  if (type === RoadType.CityPavement) return [base];
  const pieces = [base];
  const add = (label: string, rx: number, ry: number, w: number, h: number, dx = 0, dy = 0) =>
    pieces.push({ label, rect: [rx, ry, w, h], x: x * 16 + dx, y: y * 16 + dy, role: "paint" });
  switch (type) {
    case RoadType.CityLineHTop:
      add("Center line · top", 32, 1968, 16, 8, 0, 8);
      break;
    case RoadType.CityLineHBottom:
      add("Center line · bottom", 32, 1976, 16, 8);
      break;
    case RoadType.CityLineVLeft:
      add("Center line · left", 16, 1984, 8, 16, 8, 0);
      break;
    case RoadType.CityLineVRight:
      add("Center line · right", 24, 1984, 8, 16);
      break;
    case RoadType.CityCrossHLeft:
      add("Crossing · left", 64, 1984, 16, 16);
      break;
    case RoadType.CityCrossHRight:
      add("Crossing · right", 80, 1984, 16, 16);
      break;
    case RoadType.CityCrossVTop:
      add("Crossing · top", 16, 2016, 16, 16);
      break;
    case RoadType.CityCrossVBottom:
      add("Crossing · bottom", 16, 2032, 16, 16);
      break;
  }
  return pieces;
}

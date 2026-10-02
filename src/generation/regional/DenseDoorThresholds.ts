import type { BuildingRecipe } from "./BuildingRecipes.js";
import { CITY_ARCHITECTURE_BUILDINGS } from "./CityArchitectureAssets.js";

/** Native ME doorway/last-step edges audited on the pinned source sheet.
 * Coordinates refer to source pixels, not interaction positions or whole-facade
 * bounds. V4 remains unchanged; these facts are used by the v5 place plan.
 */
const SOURCE_DOORS = [
  {
    rect: [1104, 2144, 112, 80],
    doors: [{ id: "bay", x: 1152, y: 2224, width: 32, primary: false }],
  },
  {
    rect: [1312, 2144, 80, 80],
    doors: [{ id: "arched", x: 1336, y: 2208, width: 32, primary: true }],
  },
  {
    rect: [2016, 2256, 48, 32],
    doors: [{ id: "hotel-step", x: 2040, y: 2288, width: 48, primary: true }],
  },
  {
    rect: [1120, 2384, 112, 80],
    doors: [{ id: "bakery", x: 1208, y: 2464, width: 32, primary: true }],
  },
  {
    rect: [1280, 2384, 112, 80],
    doors: [
      { id: "butcher-left", x: 1320, y: 2464, width: 24, primary: true },
      { id: "butcher-right", x: 1352, y: 2464, width: 24, primary: false },
    ],
  },
  {
    rect: [1600, 2384, 112, 80],
    doors: [{ id: "ice-cream", x: 1656, y: 2464, width: 24, primary: true }],
  },
  {
    rect: [1760, 2384, 112, 80],
    doors: [{ id: "gym", x: 1848, y: 2464, width: 32, primary: true }],
  },
] as const;

export function denseDoorThresholds(recipe: BuildingRecipe) {
  const pinned = CITY_ARCHITECTURE_BUILDINGS.find((r) => r.type === recipe.type);
  if (pinned) return pinned.doorways;
  const thresholds = recipe.parts.flatMap((part) => {
    const source = SOURCE_DOORS.find(
      (s) =>
        s.rect[0] === part.frameCol * 16 &&
        s.rect[1] === part.frameRow * 16 &&
        s.rect[2] === part.spriteWidth &&
        s.rect[3] === part.spriteHeight,
    );
    return (
      source?.doors.map((door) => ({
        id: door.id,
        dx: part.dx - part.spriteWidth / 2 + door.x - source.rect[0],
        dy: part.dy - part.spriteHeight + door.y - source.rect[1],
        width: door.width,
        primary: door.primary,
      })) ?? []
    );
  });
  if (thresholds.filter((d) => d.primary).length !== 1)
    throw new Error(`Missing or ambiguous audited doorway for ${recipe.type}`);
  return thresholds;
}

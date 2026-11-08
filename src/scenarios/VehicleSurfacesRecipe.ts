import { TerrainId } from "../autotile/TerrainId.js";
import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { FLAT_SCENARIO, type ScenarioRecipe, scenarioWalls } from "./ScenarioRecipe.js";

/** Contrasting tires and drivetrains parked along the road (231). */
export const SURFACE_COURSE_CARS = [
  "compact-1",
  "rally-hatchback",
  "race-coupe",
  "offroad-jeep",
  "beach-buggy",
  "monster-truck",
  "car-21",
] as const;

/** Tile-unit rectangle of one painted terrain. */
function patch(left: number, top: number, right: number, bottom: number, terrain: TerrainId) {
  const tiles: { tx: number; ty: number; terrain: number }[] = [];
  for (let ty = top; ty < bottom; ty++)
    for (let tx = left; tx < right; tx++) tiles.push({ tx, ty, terrain });
  return tiles;
}

/** Surface review course: a straight road through grass with sand, dirt and
 * light-dirt fields either side, and cars with different tires/drivetrains. */
export function vehicleSurfacesRecipe(): ScenarioRecipe {
  return {
    version: 1,
    id: "vehicle-surfaces-v1",
    generation: FLAT_SCENARIO,
    player: createPlayer(-336, 40),
    measurePhysics: true,
    props: scenarioWalls(-400, -272, 528, 272),
    roads: [{ left: -384, top: -32, right: 512, bottom: 32 }],
    terrain: [
      // North: sand, then warm dirt; south: light dirt, with grass east of it.
      ...patch(-24, -16, -4, -3, TerrainId.Sand),
      ...patch(0, -16, 30, -3, TerrainId.DirtWarm),
      ...patch(-24, 3, 8, 16, TerrainId.DirtLight),
    ],
    parkedVehicles: SURFACE_COURSE_CARS.map((model, i) => ({
      name: model,
      model,
      wx: -300 + i * 96,
      wy: 0,
      facing: Direction.Right,
    })),
  };
}

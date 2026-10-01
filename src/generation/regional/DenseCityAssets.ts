import type { BuildingRecipe } from "./BuildingRecipes.js";
import manifest from "./dense-city-assets-v1.json" with { type: "json" };

/** Immutable promotion snapshot. Review candidates can evolve without changing a
 * saved v4 world's facade, collision or doorway. Never regenerate this in builds.
 */
export const DENSE_CITY_ASSETS = manifest;
export const DENSE_CITY_BUILDINGS = manifest.buildings as readonly (BuildingRecipe & {
  sourceType: string;
})[];
export function denseBuilding(type: string): BuildingRecipe {
  const recipe = DENSE_CITY_BUILDINGS.find((p) => p.type === type);
  if (!recipe) throw new Error(`Unknown pinned dense building: ${type}`);
  return recipe;
}

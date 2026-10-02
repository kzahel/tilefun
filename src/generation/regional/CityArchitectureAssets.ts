import type { BuildingRecipe } from "./BuildingRecipes.js";
import manifest from "./city-architecture-assets-v1.json" with { type: "json" };
/** Pinned candidate recipes. Never synthesize approvals or regenerate in builds. */
export const CITY_ARCHITECTURE_ASSETS = manifest;
export const CITY_ARCHITECTURE_BUILDINGS = manifest.buildings as readonly (BuildingRecipe & {
  name: string;
  doorways: { id: string; dx: number; dy: number; width: number; primary: boolean }[];
})[];

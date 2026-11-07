import { racetrackRecipe, shoppingRecipe } from "../scenarios/RoadTrafficRecipe.js";
import type { ScenarioRecipe } from "../scenarios/ScenarioRecipe.js";

/** Ambient-traffic lab scenes restored in 225: one start beside the action, fixed
 * framing and the game's mesh renderer. */
export const TRAFFIC_FIXTURES: Record<
  string,
  { recipe: () => ScenarioRecipe; zoom: number; camera: { wx: number; wy: number } }
> = {
  racetrack: { recipe: racetrackRecipe, zoom: 0.125, camera: { wx: 0, wy: -16 } },
  shopping: { recipe: shoppingRecipe, zoom: 0.25, camera: { wx: 640, wy: 360 } },
};

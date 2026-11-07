import { buildLaneGraph } from "../traffic/LaneGraph.js";
import { addRacetrackLanes } from "../traffic/RacetrackLanes.js";
import type { ShoppingSource } from "../traffic/ShoppingVisits.js";
import type { VehicleSource } from "../traffic/VehicleRegistry.js";
import type { ScenarioRecipe } from "./ScenarioRecipe.js";

/** A recipe's fixed road lanes, speedway rings and shopping centers, as the same
 * vehicle source a generated world supplies. */
export function scenarioVehicleSource(
  recipe: ScenarioRecipe,
): (VehicleSource & ShoppingSource) | undefined {
  if (!recipe.trafficRoads && !recipe.racetracks) return undefined;
  const graph = buildLaneGraph(recipe.trafficRoads ?? []);
  addRacetrackLanes(graph, recipe.racetracks ?? []);
  const centers = recipe.shoppingCenters ?? [];
  return { trafficNetwork: () => graph, shoppingCenters: () => centers };
}

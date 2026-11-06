import { createPlayer } from "../entities/Player.js";
import { createDescriptor } from "../generation/GenerationDescriptor.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { RailwayPlanner } from "../railway/RailwayPlanner.js";
import { required } from "../shared/required.js";
import type { ScenarioRecipe } from "./ScenarioRecipe.js";

/** Production seeded towns, track, benches and ordinary shared authority. */
export function cityTrainRecipe(): ScenarioRecipe {
  const planner = new RailwayPlanner(regionalWorld(2026));
  const start = required(planner.start());
  return {
    version: 1,
    id: "rideable-city-trains-v1",
    generation: createDescriptor("regional", 2026),
    player: createPlayer((start.x - 12) * 16, start.y * 16 + 4),
    props: [],
  };
}

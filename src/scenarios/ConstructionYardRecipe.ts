import { createPlayer } from "../entities/Player.js";
import { createDescriptor } from "../generation/GenerationDescriptor.js";
import { constructionYard } from "../generation/regional/ConstructionYard.js";
import { MotocrossSource } from "../generation/regional/MotocrossPlanner.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { required } from "../shared/required.js";
import type { ScenarioRecipe } from "./ScenarioRecipe.js";

export function constructionYardSite() {
  return constructionYard(required(new MotocrossSource(regionalWorld(2026)).owner(0, 0)));
}

export function constructionYardRecipe(): ScenarioRecipe {
  const yard = constructionYardSite();
  return {
    version: 1,
    id: "construction-yard-v3",
    generation: createDescriptor("regional", 2026),
    player: createPlayer(yard.arrival.x * 16, yard.arrival.y * 16),
    props: [],
  };
}

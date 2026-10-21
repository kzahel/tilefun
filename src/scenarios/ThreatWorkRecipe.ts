import { createPlayer } from "../entities/Player.js";
import { createFauna } from "../wildlife/Fauna.js";
import { createPredator } from "../wildlife/Predator.js";
import { FLAT_SCENARIO, type ScenarioRecipe } from "./ScenarioRecipe.js";

export function threatWorkRecipe(kind: "hedgehog" | "porcupine" | "fox"): ScenarioRecipe {
  return {
    version: 1,
    id: `threat-work-${kind}-v1`,
    generation: FLAT_SCENARIO,
    player: createPlayer(320, 304),
    actors: [
      createFauna(kind, 112, 176),
      kind === "fox" ? createFauna("mouse", 164, 176) : createPredator("wolf", 192, 176),
    ],
    props: [],
    traffic: [],
  };
}

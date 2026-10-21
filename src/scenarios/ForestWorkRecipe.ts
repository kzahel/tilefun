import { createPlayer } from "../entities/Player.js";
import { createDeer } from "../wildlife/Deer.js";
import { createFauna } from "../wildlife/Fauna.js";
import { createFoodSource, createForageItem } from "../wildlife/ForageResources.js";
import { FLAT_SCENARIO, type ScenarioRecipe } from "./ScenarioRecipe.js";

/** Ordinary authority, native travel and real conserved resources/partners. */
export function forestWorkRecipe(kind: "deer" | "peacock" | "raven"): ScenarioRecipe {
  const actors =
    kind === "deer"
      ? [createDeer(112, 176), createFoodSource("browse-shrub", 168, 184)]
      : kind === "peacock"
        ? [createFauna(kind, 112, 176), createFauna(kind, 208, 176)]
        : [
            createFauna(kind, 112, 176),
            createForageItem("shiny", 176, 180),
            createForageItem("shiny", 176, 216),
            createForageItem("shiny", 152, 240),
          ];
  return {
    version: 1,
    id: `forest-work-${kind}-v1`,
    generation: FLAT_SCENARIO,
    player: createPlayer(320, 304),
    actors,
    props: [],
    traffic: [],
  };
}

import { createPlayer } from "../entities/Player.js";
import { createFauna } from "../wildlife/Fauna.js";
import { createFoodSource, createForageItem } from "../wildlife/ForageResources.js";
import { FLAT_SCENARIO, type ScenarioRecipe } from "./ScenarioRecipe.js";

/** Shared production work, ordinary saved supplies and actual flock mates. */
export function herdWorkRecipe(kind: "cow" | "sheep" | "donkey"): ScenarioRecipe {
  const animal = createFauna(kind, 112, 176);
  const actors =
    kind === "sheep"
      ? [animal, createFauna(kind, 208, 160), createFauna(kind, 208, 196)]
      : kind === "cow"
        ? [animal, createFoodSource("growing-plant", 160, 184)]
        : [animal, createForageItem("dust", 160, 184)];
  return {
    version: 1,
    id: `herd-work-${kind}-v1`,
    generation: FLAT_SCENARIO,
    player: createPlayer(320, 304),
    actors,
    props: [],
    traffic: [],
  };
}

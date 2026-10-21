import { createPlayer } from "../entities/Player.js";
import { createFauna } from "../wildlife/Fauna.js";
import { createFoodSource, createForageItem } from "../wildlife/ForageResources.js";
import { FLAT_SCENARIO, type ScenarioRecipe } from "./ScenarioRecipe.js";

/** Ordinary resources, props and saved actors, with production AI only. */
export function rangeWorkRecipe(kind: "horse" | "giraffe" | "beaver"): ScenarioRecipe {
  const a = createFauna(kind, 112, 176);
  const actors =
    kind === "horse"
      ? [a, createFoodSource("growing-plant", 144, 176), createFoodSource("spring-pool", 176, 192)]
      : kind === "giraffe"
        ? [a, createFoodSource("canopy-leaves", 208, 152)]
        : [
            a,
            createFoodSource("branch-pile", 144, 184),
            createFoodSource("branch-pile", 160, 208),
            createForageItem("lodge", 104, 216),
          ];
  return {
    version: 1,
    id: `range-work-${kind}-v1`,
    generation: FLAT_SCENARIO,
    player: createPlayer(320, 304),
    props: [],
    nativeProps: kind === "giraffe" ? [{ type: "prop-palm-tree", wx: 208, wy: 152 }] : [],
    actors,
    traffic: [],
  };
}

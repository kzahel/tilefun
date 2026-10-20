import { createPlayer } from "../entities/Player.js";
import { createFauna } from "../wildlife/Fauna.js";
import { createFoodSource } from "../wildlife/ForageResources.js";
import { FLAT_SCENARIO, type ScenarioRecipe } from "./ScenarioRecipe.js";

/** Ordinary editor resources and props; all decisions run in the production Realm. */
export function pastureWorkRecipe(kind: "goat" | "pig" | "elephant"): ScenarioRecipe {
  const animal = createFauna(kind === "pig" ? "piglet" : kind, 112, 176);
  const food = createFoodSource(
    kind === "goat" ? "browse-shrub" : kind === "pig" ? "root-patch" : "fruit-tree",
    kind === "elephant" ? 208 : 160,
    kind === "elephant" ? 152 : 176,
  );
  return {
    version: 1,
    id: `pasture-work-${kind}-v1`,
    generation: FLAT_SCENARIO,
    player: createPlayer(320, 304),
    props: [],
    nativeProps:
      kind === "goat"
        ? [{ type: "prop-low-rock", wx: 112, wy: 128 }]
        : kind === "elephant"
          ? [{ type: "prop-oak-tree", wx: 208, wy: 152 }]
          : [],
    actors: [animal, food],
    traffic: [],
  };
}

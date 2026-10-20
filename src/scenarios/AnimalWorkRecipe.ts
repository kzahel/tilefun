import { createPlayer } from "../entities/Player.js";
import { createFauna } from "../wildlife/Fauna.js";
import { createForageItem } from "../wildlife/ForageResources.js";
import { FLAT_SCENARIO, type ScenarioRecipe } from "./ScenarioRecipe.js";

/** Ordinary actors/resources and real tree geometry; no fixture-specific AI. */
export function animalWorkRecipe(kind: "dog" | "crow" | "squirrel"): ScenarioRecipe {
  const worker = createFauna(kind === "squirrel" ? "red-squirrel" : kind, 128, 156);
  const resources =
    kind === "dog"
      ? []
      : [
          [88, 176],
          [168, 176],
          [88, 208],
          [168, 208],
        ].map(([x = 0, y = 0], i) =>
          createForageItem(kind === "crow" ? "twig" : i % 2 ? "fruit" : "nut", x, y),
        );
  return {
    version: 1,
    id: `animal-work-${kind}-v1`,
    generation: FLAT_SCENARIO,
    player: createPlayer(kind === "dog" ? 64 : 272, kind === "dog" ? 128 : 232),
    props: [],
    nativeProps: kind === "crow" ? [{ type: "prop-oak-tree", wx: 128, wy: 104 }] : [],
    actors: [worker, ...resources],
    traffic: [],
  };
}

import { createPlayer } from "../entities/Player.js";
import { createFauna } from "../wildlife/Fauna.js";
import { createFoodSource } from "../wildlife/ForageResources.js";
import { FLAT_SCENARIO, type ScenarioRecipe } from "./ScenarioRecipe.js";

export function gardenWorkRecipe(kind: "chicken" | "bee" | "hummingbird"): ScenarioRecipe {
  const a = createFauna(kind === "hummingbird" ? "ruby-throated-hummingbird" : kind, 112, 176);
  const actors = [
    a,
    createFoodSource(kind === "chicken" ? "scratch-patch" : "nectar-flower", 144, 176),
  ];
  if (kind !== "chicken") {
    actors.push(createFoodSource("nectar-flower", 176, 160));
    const crop = createFoodSource("growing-plant", 176, 190);
    if (crop.workItem?.growth) {
      crop.workItem.units = 0;
      crop.workItem.growth.remaining = 120;
    }
    actors.push(crop);
  }
  return {
    version: 1,
    id: `garden-work-${kind}-v1`,
    generation: FLAT_SCENARIO,
    player: createPlayer(320, 304),
    props: [],
    actors,
    traffic: [],
  };
}

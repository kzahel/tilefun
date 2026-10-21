import { applyPlayerModel } from "../characters/PlayerModels.js";
import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { FLAT_SCENARIO, type ScenarioRecipe } from "./ScenarioRecipe.js";

export function transporterRecipe(): ScenarioRecipe {
  const player = createPlayer(12, 44);
  applyPlayerModel(player, "character-person-v1");
  return {
    version: 1,
    id: "single-car-transporter",
    generation: FLAT_SCENARIO,
    player,
    props: [],
    roads: [{ left: -768, right: 768, top: -256, bottom: 256 }],
    trafficSpeed: 0,
    parkedVehicles: [
      { model: "car-transporter", wx: 0, wy: 0, facing: Direction.Right },
      { model: "beetle", wx: -205, wy: 0, facing: Direction.Right },
    ],
  };
}

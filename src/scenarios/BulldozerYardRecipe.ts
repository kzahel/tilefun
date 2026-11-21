import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { FLAT_SCENARIO, type ScenarioRecipe, scenarioWalls } from "./ScenarioRecipe.js";

export function bulldozerYardRecipe(): ScenarioRecipe {
  return {
    version: 1,
    id: "bulldozer-yard-v1",
    generation: FLAT_SCENARIO,
    player: createPlayer(-144, 44),
    props: scenarioWalls(-288, -160, 320, 160),
    roads: [{ left: -288, right: 320, top: -32, bottom: 64 }],
    parkedVehicles: [
      { name: "car", model: "bulldozer", wx: -144, wy: 0, facing: Direction.Right },
      { name: "push-car", model: "beetle", wx: -30, wy: 0, facing: Direction.Right },
    ],
  };
}

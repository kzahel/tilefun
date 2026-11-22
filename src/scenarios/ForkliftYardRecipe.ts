import {
  CONSTRUCTION_CRATE,
  CONSTRUCTION_PALLET,
  createConstructionCargo,
} from "../entities/ConstructionCargo.js";
import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { FLAT_SCENARIO, type ScenarioRecipe, scenarioWalls } from "./ScenarioRecipe.js";

export function forkliftYardRecipe(): ScenarioRecipe {
  return {
    version: 1,
    id: "construction-forklift-v1",
    generation: FLAT_SCENARIO,
    player: createPlayer(-106, 31),
    props: scenarioWalls(-220, -118, 226, 124),
    roads: [{ left: -208, top: -80, right: 224, bottom: 80 }],
    nativeProps: [
      { type: "prop-shed", wx: 125, wy: -80 },
      { type: "prop-street-lamp", wx: -154, wy: -62 },
      { type: "prop-street-lamp", wx: 171, wy: 77 },
      { type: "prop-city-street-v1-bollard", wx: -174, wy: 67 },
      { type: "prop-city-street-v1-bollard", wx: -149, wy: 67 },
    ],
    parkedVehicles: [
      { name: "forklift", model: "forklift", wx: -106, wy: 0, facing: Direction.Right },
      { name: "flatbed", model: "flatbed-truck", wx: 84, wy: 0, facing: Direction.Right },
    ],
    actors: [
      createConstructionCargo(CONSTRUCTION_PALLET, -51, 0),
      createConstructionCargo(CONSTRUCTION_CRATE, -51, 41),
      createConstructionCargo(CONSTRUCTION_CRATE, 31, 41),
      createConstructionCargo(CONSTRUCTION_PALLET, -61, -47),
    ],
  };
}

import { createConstructionCargo } from "../entities/ConstructionCargo.js";
import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import {
  MARBLE_CHUTE_X,
  MARBLE_CRANE_START,
  marbleRunActors,
  SEESAW_CAR_START,
  seesawActors,
} from "../generation/regional/ConstructionPlayground.js";
import { FLAT_SCENARIO, type ScenarioRecipe } from "./ScenarioRecipe.js";

function playground(
  id: string,
  start: { wx: number; wy: number },
  actors: ReturnType<typeof marbleRunActors> | ReturnType<typeof seesawActors>,
): ScenarioRecipe {
  return {
    version: 1,
    id,
    generation: FLAT_SCENARIO,
    player: createPlayer(start.wx, start.wy + 30),
    props: [],
    roads: [{ left: -208, right: 208, top: -64, bottom: 64 }],
    nativeProps: [
      { type: "prop-shed", wx: 45, wy: -66 },
      { type: "prop-street-lamp", wx: -181, wy: -51 },
      { type: "prop-street-lamp", wx: 197, wy: 85 },
      ...[-153, -121, 118, 146].map((wx) => ({
        type: "prop-city-street-v1-bollard",
        wx,
        wy: -51,
      })),
    ],
    actors: actors.map((placement) => {
      const actor = createConstructionCargo(placement.type, placement.wx, placement.wy);
      if ("wz" in placement) {
        actor.wz = placement.wz;
        actor.jumpVZ = 0;
      }
      return actor;
    }),
  };
}

export function marbleRunRecipe(): ScenarioRecipe {
  const recipe = playground("construction-marble-run-v1", MARBLE_CRANE_START, marbleRunActors());
  recipe.parkedVehicles = [
    { model: "mobile-crane", ...MARBLE_CRANE_START, facing: Direction.Right },
    { model: "forklift", wx: MARBLE_CHUTE_X, wy: 63, facing: Direction.Up },
  ];
  return recipe;
}

export function seesawRecipe(): ScenarioRecipe {
  const recipe = playground("construction-seesaw-v1", SEESAW_CAR_START, seesawActors());
  recipe.parkedVehicles = [
    { model: "race-coupe", ...SEESAW_CAR_START, facing: Direction.Right },
    { model: "dump-truck", wx: 145, wy: 51, facing: Direction.Left },
  ];
  return recipe;
}

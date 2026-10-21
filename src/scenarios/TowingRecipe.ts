import { applyPlayerModel } from "../characters/PlayerModels.js";
import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { vehicleCardinalHeading } from "../traffic/Vehicle.js";
import { FLAT_SCENARIO, type ScenarioRecipe } from "./ScenarioRecipe.js";

export function towingRecipe(direction = Direction.Right): ScenarioRecipe {
  const h = vehicleCardinalHeading(direction),
    c = Math.cos(h),
    s = Math.sin(h);
  const player = createPlayer(12 * c - 40 * s, 12 * s + 40 * c);
  applyPlayerModel(player, "character-person-v1");
  return {
    version: 1,
    id: "wheel-lift-towing",
    generation: FLAT_SCENARIO,
    player,
    props: [],
    roads: [{ left: -640, right: 640, top: -160, bottom: 160 }],
    trafficSpeed: 0,
    parkedVehicles: [
      { model: "tow-truck", wx: 0, wy: 0, facing: direction },
      { model: "beetle", wx: -104 * c, wy: -104 * s, facing: direction },
    ],
  };
}

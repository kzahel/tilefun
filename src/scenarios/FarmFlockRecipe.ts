import { createPlayer } from "../entities/Player.js";
import {
  CHICKEN_FEEDER,
  FARM_EGG,
  FARM_FACTORIES,
  GARDEN_FENCE,
  GARDEN_FENCE_SIDE,
} from "../farming/FarmActors.js";
import { FARM_GATE } from "../farming/FarmGate.js";
import { required } from "../shared/required.js";
import { createFauna } from "../wildlife/Fauna.js";
import { FLAT_SCENARIO, type ScenarioRecipe } from "./ScenarioRecipe.js";

/** A pen close enough for immediate native-pixel comparison in the game view. */
export function farmFlockRecipe(): ScenarioRecipe {
  const place = (type: string, wx: number, wy: number) => ({ type, wx, wy });
  return {
    version: 1,
    id: "farm-chicken-flock-v1",
    generation: FLAT_SCENARIO,
    player: createPlayer(88, 152),
    props: [],
    nativeProps: [
      ...[48, 80, 112, 144].map((x) => place(GARDEN_FENCE, x, 32)),
      ...[48, 80, 112].flatMap((y) => [
        place(GARDEN_FENCE_SIDE, 32, y),
        place(GARDEN_FENCE_SIDE, 168, y),
      ]),
      ...[48, 128, 152].map((x) => place(GARDEN_FENCE, x, 144)),
      place(FARM_GATE, 88, 144),
    ],
    actors: [
      required(FARM_FACTORIES[CHICKEN_FEEDER])(88, 128),
      required(FARM_FACTORIES[FARM_EGG])(65, 104),
      createFauna("chicken", 63, 80),
      createFauna("rooster", 95, 80),
      createFauna("chick", 128, 80),
    ],
  };
}

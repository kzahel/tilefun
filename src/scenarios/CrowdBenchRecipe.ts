import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { createRabbit } from "../wildlife/Rabbit.js";
import { FLAT_SCENARIO, type ScenarioRecipe } from "./ScenarioRecipe.js";

const CAR_MODELS = [
  "compact-1",
  "beetle",
  "police-car",
  "rosso-coupe",
  "rally-hatchback",
  "tow-truck",
  "dump-truck",
  "garbage-truck-orange",
];

/** The player stands between the car lot and the rabbit field. */
export const CROWD_CENTER = { wx: 640, wy: 534 };
/** Lab framing that keeps the whole crowd (about 1,200×960 px) in view. */
export const CROWD_VIEW = { camera: { wx: 640, wy: 690 }, zoom: 0.2 };

/**
 * Fixed crowd for `npm run crowd:bench` and the world-geometry `crowd` lab: rabbits
 * and parked cars packed into about 4×4 chunks on flat ground, all inside the
 * player's default 5×5-chunk view, so every actor is in view and simulated.
 * Ordinary Realm actors, vehicle records and AI; only placement is synthetic.
 */
export function crowdBenchRecipe(rabbits = 1000, cars = 50): ScenarioRecipe {
  if (!Number.isInteger(rabbits) || rabbits < 0 || rabbits > 1000)
    throw Error("Rabbits must be 0–1000");
  if (!Number.isInteger(cars) || cars < 0 || cars > 50) throw Error("Cars must be 0–50");
  return {
    version: 1,
    id: `crowd-bench-${rabbits}-${cars}`,
    generation: FLAT_SCENARIO,
    player: createPlayer(CROWD_CENTER.wx, CROWD_CENTER.wy),
    props: [],
    measurePhysics: true,
    // 50 cars: ten columns of 124 px by five rows of 56 px, north of the player
    // (the garbage truck is 120×47 px).
    parkedVehicles: Array.from({ length: cars }, (_, i) => ({
      model: CAR_MODELS[i % CAR_MODELS.length] ?? "compact-1",
      wx: 82 + (i % 10) * 124,
      wy: 224 + Math.floor(i / 10) * 56,
      facing: Direction.Right,
    })),
    // 1,000 rabbits: forty columns by twenty-five rows at 24 px, south of the player.
    actors: Array.from({ length: rabbits }, (_, i) =>
      createRabbit(172 + (i % 40) * 24, 594 + Math.floor(i / 40) * 24),
    ),
  };
}

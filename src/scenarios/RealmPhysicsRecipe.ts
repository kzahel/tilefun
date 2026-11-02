import { createBall } from "../entities/Ball.js";
import { Direction } from "../entities/Entity.js";
import { ENTITY_FACTORIES } from "../entities/EntityFactories.js";
import { createPlayer } from "../entities/Player.js";
import { createFauna } from "../wildlife/Fauna.js";
import { FLAT_SCENARIO, type ScenarioRecipe } from "./ScenarioRecipe.js";
import { worldGeometryRecipe } from "./WorldGeometryRecipe.js";

/** Same Realm actors/controllers as the game; only staging/framing is diagnostic. */
export function realmPhysicsRecipe(crowd?: number): ScenarioRecipe {
  if (crowd !== undefined) {
    if (!Number.isInteger(crowd) || crowd < 0 || crowd > 384) throw Error("Crowd must be 0–384");
    return {
      version: 1,
      id: `realm-physics-crowd-${crowd}`,
      generation: FLAT_SCENARIO,
      player: createPlayer(32, 32),
      props: [],
      measurePhysics: true,
      actors: Array.from({ length: crowd }, (_, i) =>
        createFauna("dog", 96 + (i % 16) * 24, 96 + Math.floor(i / 16) * 18),
      ),
    };
  }
  const recipe = worldGeometryRecipe();
  const chicken = ENTITY_FACTORIES.chicken?.(-188, 76),
    person = ENTITY_FACTORIES.person1?.(-80, -92);
  if (!chicken || !person) throw Error("Missing ordinary NPC definitions");
  const ball = createBall(-160, 76);
  ball.wz = 16;
  ball.jumpVZ = 0;
  return {
    ...recipe,
    id: "realm-physics-proof",
    measurePhysics: true,
    actors: [chicken, person, ball],
    parkedVehicles: [{ model: "compact-1", wx: 64, wy: 100, facing: Direction.Right }],
  };
}

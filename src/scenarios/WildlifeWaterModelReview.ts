import { TerrainId } from "../autotile/TerrainId.js";
import { createPlayer } from "../entities/Player.js";
import { createFauna, faunaProfile } from "../wildlife/Fauna.js";
import { createFrog, FROG_TYPE } from "../wildlife/Frog.js";
import { createMallard, MALLARD_TYPE } from "../wildlife/Mallard.js";
import { createPredator, predatorProfile } from "../wildlife/Predator.js";
import { FLAT_SCENARIO, type ScenarioRecipe } from "./ScenarioRecipe.js";

export function isPondPilotModel(type: string): boolean {
  return type === FROG_TYPE || type === MALLARD_TYPE;
}

function waterReviewActors(type: string, animal: ReturnType<typeof faunaProfile>) {
  if (type === FROG_TYPE) return [createFrog(240, 227), createFrog(255, 328)];
  if (type === MALLARD_TYPE) return [createMallard(240, 227), createMallard(255, 328)];
  const hunter = predatorProfile(type);
  if (hunter?.expansion?.habitat === "deep")
    return [
      createPredator(hunter.species, 240, 176),
      createFauna("fish", 311, 176),
      createFauna("fish", 294, 226),
    ];
  if (animal?.habitat === "shore")
    return [createFauna(animal.species, 214, 328), createFauna(animal.species, 265, 292)];
  if (animal?.habitat === "deep" || animal?.habitat === "pond")
    return [createFauna(animal.species, 240, 176)];
  return undefined;
}

/** Habitat and prey in an ordinary Realm, shared by exact previews and playback checks. */
export function wildlifeWaterModelReviewRecipe(
  id: string,
  type: string,
): ScenarioRecipe | undefined {
  const animal = faunaProfile(type);
  const nativePondPilot = isPondPilotModel(type);
  const pond = animal?.habitat === "pond" || nativePondPilot;
  const actors = waterReviewActors(type, animal);
  if (!actors) return undefined;
  const terrain: NonNullable<ScenarioRecipe["terrain"]> = [];
  for (let ty = 2; ty <= 20; ty++) {
    for (let tx = 2; tx <= 28; tx++) {
      const shore = ty === 2 || ty === 20 || tx === 2 || tx === 28;
      const shallows = pond || (animal?.habitat === "shore" && ty >= 18);
      terrain.push({
        tx,
        ty,
        terrain: shore ? TerrainId.Sand : shallows ? TerrainId.ShallowWater : TerrainId.DeepWater,
      });
    }
  }
  return {
    version: 1,
    id,
    generation: FLAT_SCENARIO,
    player: createPlayer(240, nativePondPilot ? 412 : 344),
    terrain,
    props: [],
    actors,
  };
}

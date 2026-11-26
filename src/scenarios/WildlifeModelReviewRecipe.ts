import { TerrainId } from "../autotile/TerrainId.js";
import { ENTITY_FACTORIES } from "../entities/EntityFactories.js";
import { createPlayer } from "../entities/Player.js";
import { DEER_TYPE } from "../wildlife/Deer.js";
import { createFauna, faunaProfile } from "../wildlife/Fauna.js";
import { sourceType } from "../wildlife/ForageResources.js";
import { createPredator, predatorProfile } from "../wildlife/Predator.js";
import { forestWorkRecipe } from "./ForestWorkRecipe.js";
import { naturalLandscapeRecipe } from "./NaturalLandscapeRecipe.js";
import { FLAT_SCENARIO, type ScenarioRecipe } from "./ScenarioRecipe.js";
import {
  groundHunterReviewActors,
  isRaptorModelReviewCase,
  isWildlifeBehaviorModelReview,
  raptorModelReviewRecipe,
} from "./WildlifeBehaviorModelReview.js";
import { wildlifeWaterModelReviewRecipe } from "./WildlifeWaterModelReview.js";

const FARM_MODEL_CASES = new Set([
  "behavior-chicken",
  "behavior-cow",
  "behavior-donkey",
  "behavior-goat",
  "behavior-horse",
  "behavior-pig",
  "behavior-sheep",
]);

export function isFarmModelReviewCase(caseId: string): boolean {
  return FARM_MODEL_CASES.has(caseId);
}

export function canLandOnReviewAnimal(type: string, caseId: string): boolean {
  return (
    !isFarmModelReviewCase(caseId) ||
    caseId === "behavior-chicken" ||
    !!faunaProfile(type)?.rideSpeed
  );
}

export function isFourStateFaunaModelReview(type: string, caseId: string): boolean {
  const animal = faunaProfile(type);
  return (
    animal?.species === caseId &&
    !animal.rideSpeed &&
    !["deep", "pond", "shore"].includes(animal.habitat) &&
    /^idle\/(?:walk|hop|fly|flutter|crawl|slither)\/action\/flee$/.test(
      animal.clips.map(({ name }) => name).join("/"),
    )
  );
}

export function isPackMountModelReview(type: string, caseId: string): boolean {
  return (caseId === "camel" || caseId === "mule") && faunaProfile(type)?.species === caseId;
}

/** The editor setup mirrors each animal's existing feeding scenario. */
export function wildlifeFeedingReview(type: string, caseId: string) {
  if (type === DEER_TYPE && caseId === "behavior-deer")
    return { resource: sourceType("browse-shrub"), dx: 56, dy: 8 };
  const species = faunaProfile(type)?.species;
  if (species === "elephant" && caseId === "behavior-elephant")
    return { resource: sourceType("fruit-tree"), prop: "prop-oak-tree", dx: 96, dy: -24 };
  if (species === "giraffe" && caseId === "behavior-giraffe")
    return { resource: sourceType("canopy-leaves"), prop: "prop-palm-tree", dx: 96, dy: -24 };
  return undefined;
}

function modelStage(
  id: string,
  player: ScenarioRecipe["player"],
  actors: NonNullable<ScenarioRecipe["actors"]>,
  terrain?: ScenarioRecipe["terrain"],
): ScenarioRecipe {
  return {
    version: 1,
    id,
    generation: FLAT_SCENARIO,
    player,
    props: [],
    actors,
    ...(terrain ? { terrain } : {}),
  };
}

function classicModelStage(id: string, type: string, travel: string): ScenarioRecipe | undefined {
  const actor = ENTITY_FACTORIES[type]?.(128, 160);
  if (!actor) return undefined;
  const terrain: NonNullable<ScenarioRecipe["terrain"]> = [];
  if (travel === "swim") {
    for (let ty = 4; ty <= 16; ty++)
      for (let tx = 3; tx <= 17; tx++) terrain.push({ tx, ty, terrain: TerrainId.ShallowWater });
  }
  return modelStage(id, createPlayer(223, 282), [actor], terrain);
}

/** Known actors in an ordinary Realm for exact habitat and hunt review. */
export function wildlifeModelReviewRecipe(
  type: string,
  caseId: string,
  classicTravel?: string,
): ScenarioRecipe | undefined {
  const id = `wildlife-model-review-${type}`;
  if (classicTravel) return classicModelStage(id, type, classicTravel);
  if (isFarmModelReviewCase(caseId) || isWildlifeBehaviorModelReview(type, caseId))
    return naturalLandscapeRecipe(caseId, "balanced");
  if (isRaptorModelReviewCase(caseId)) return raptorModelReviewRecipe(caseId);
  if (wildlifeFeedingReview(type, caseId))
    return type === DEER_TYPE
      ? forestWorkRecipe("deer")
      : naturalLandscapeRecipe(caseId, "balanced");
  const animal = faunaProfile(type);
  if (animal && (isFourStateFaunaModelReview(type, caseId) || isPackMountModelReview(type, caseId)))
    return modelStage(id, createPlayer(240, 350), [createFauna(animal.species, 240, 176)]);
  const groundHunters = groundHunterReviewActors(type, caseId);
  if (groundHunters) return modelStage(id, createPlayer(240, 344), groundHunters);
  const hunter = predatorProfile(type);
  if (hunter?.species === "coconut-crab")
    return modelStage(id, createPlayer(240, 328), [
      createPredator(hunter.species, 240, 176),
      createFauna("cricket", 303, 176),
      createFauna("worm", 293, 224),
    ]);
  return wildlifeWaterModelReviewRecipe(id, type);
}

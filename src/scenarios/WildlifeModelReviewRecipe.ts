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

export function isFourStateFaunaModelReview(type: string, caseId: string): boolean {
  const animal = faunaProfile(type);
  return (
    animal?.species === caseId &&
    !animal.rideSpeed &&
    !["deep", "pond", "shore"].includes(animal.habitat) &&
    ["idle/walk/action/flee", "idle/hop/action/flee", "idle/fly/action/flee"].includes(
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

/** Known actors in an ordinary Realm for exact habitat and hunt review. */
export function wildlifeModelReviewRecipe(
  type: string,
  caseId: string,
  classicTravel?: string,
): ScenarioRecipe | undefined {
  const id = `wildlife-model-review-${type}`;
  if (classicTravel) {
    const actor = ENTITY_FACTORIES[type]?.(128, 160);
    if (!actor) return undefined;
    const terrain: NonNullable<ScenarioRecipe["terrain"]> = [];
    if (classicTravel === "swim") {
      for (let ty = 4; ty <= 16; ty++)
        for (let tx = 3; tx <= 17; tx++) terrain.push({ tx, ty, terrain: TerrainId.ShallowWater });
    }
    return {
      version: 1,
      id,
      generation: FLAT_SCENARIO,
      player: createPlayer(223, 282),
      props: [],
      terrain,
      actors: [actor],
    };
  }
  if (isFarmModelReviewCase(caseId)) return naturalLandscapeRecipe(caseId, "balanced");
  if (wildlifeFeedingReview(type, caseId))
    return type === DEER_TYPE
      ? forestWorkRecipe("deer")
      : naturalLandscapeRecipe(caseId, "balanced");
  const animal = faunaProfile(type);
  if (animal && (isFourStateFaunaModelReview(type, caseId) || isPackMountModelReview(type, caseId)))
    return {
      version: 1,
      id,
      generation: FLAT_SCENARIO,
      player: createPlayer(240, 350),
      props: [],
      actors: [createFauna(animal.species, 240, 176)],
    };
  const hunter = predatorProfile(type);
  if (hunter?.species === "coconut-crab")
    return {
      version: 1,
      id,
      generation: FLAT_SCENARIO,
      player: createPlayer(240, 328),
      props: [],
      actors: [
        createPredator(hunter.species, 240, 176),
        createFauna("cricket", 303, 176),
        createFauna("worm", 293, 224),
      ],
    };
  const pond = animal?.habitat === "pond";
  const actors =
    hunter?.expansion?.habitat === "deep"
      ? [
          createPredator(hunter.species, 240, 176),
          createFauna("fish", 311, 176),
          createFauna("fish", 294, 226),
        ]
      : animal && (animal.habitat === "deep" || pond)
        ? [createFauna(animal.species, 240, 176)]
        : animal?.habitat === "shore"
          ? [createFauna(animal.species, 214, 328), createFauna(animal.species, 265, 292)]
          : undefined;
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
    player: createPlayer(240, 344),
    props: [],
    terrain,
    actors,
  };
}

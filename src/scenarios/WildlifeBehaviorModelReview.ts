import { createDeer } from "../wildlife/Deer.js";
import { createFauna, faunaProfile } from "../wildlife/Fauna.js";
import { createPredator, predatorProfile } from "../wildlife/Predator.js";
import { createRabbit } from "../wildlife/Rabbit.js";
import { naturalLandscapeRecipe } from "./NaturalLandscapeRecipe.js";

export function isCatModelReview(type: string, caseId: string): boolean {
  return (
    /^behavior-cat(?:-ginger|-black)?$/.test(caseId) &&
    faunaProfile(type)?.species === caseId.slice(9)
  );
}

export function isWildlifeWorkModelReviewCase(caseId: string): boolean {
  return /^behavior-(?:crow|raven|hummingbird|peacock|bee|fox|hedgehog|porcupine|meerkat|raccoon|squirrel|beaver|capuchin)$/.test(
    caseId,
  );
}

export function isSpineDefenseModelReviewCase(caseId: string): boolean {
  return caseId === "behavior-hedgehog" || caseId === "behavior-porcupine";
}

export function wildlifeWorkModelReviewRecipe(caseId: string) {
  const scene = naturalLandscapeRecipe(caseId, "balanced");
  if (scene.actors && isSpineDefenseModelReviewCase(caseId)) {
    // A player can approach and retreat to demonstrate both defense and flight.
    scene.actors = scene.actors.filter((actor) => !actor.predator);
  }
  return scene;
}

export function isRaptorModelReviewCase(caseId: string): boolean {
  return /^(?:eagle|hawk|owl|secretary-bird)$/.test(caseId);
}

const GROUND_HUNTERS_WITH_RABBIT_PREY = new Set([
  "bobcat",
  "lynx",
  "cheetah",
  "jaguar",
  "leopard",
  "lion",
  "tiger",
  "panther",
  "brown-bear",
  "polar-bear",
  "coyote",
  "wolf",
  "fossa",
  "honey-badger",
  "mongoose",
  "white-nosed-coati",
  "spotted-hyena",
  "tasmanian-devil",
  "alligator",
  "crocodile",
  "komodo-dragon",
]);
const GROUND_HUNTERS_WITH_CRICKET_PREY = new Set([
  "centipede",
  "praying-mantis",
  "scorpion",
  "spider",
]);

export function isGroundHunterModelReviewCase(caseId: string): boolean {
  return (
    GROUND_HUNTERS_WITH_RABBIT_PREY.has(caseId) ||
    GROUND_HUNTERS_WITH_CRICKET_PREY.has(caseId) ||
    caseId === "gaboon-viper"
  );
}

export function isDenHunterModelReviewCase(caseId: string): boolean {
  return /^(?:griffin|small-dragon|t-rex|giant-spider|dire-wolf)$/.test(caseId);
}

export function groundHunterReviewActors(type: string, caseId: string) {
  const hunter = predatorProfile(type);
  if (hunter?.species !== caseId) return undefined;
  if (isDenHunterModelReviewCase(caseId) && caseId !== "giant-spider")
    return [createPredator(hunter.species, 240, 176), createDeer(347, 176), createRabbit(335, 233)];
  const predator = createPredator(hunter.species, 240, 176);
  if (GROUND_HUNTERS_WITH_CRICKET_PREY.has(caseId))
    return [predator, createFauna("cricket", 294, 176), createFauna("cricket", 286, 219)];
  if (caseId === "gaboon-viper")
    return [predator, createFauna("mouse", 281, 176), createFauna("mouse", 272, 207)];
  if (GROUND_HUNTERS_WITH_RABBIT_PREY.has(caseId) || caseId === "giant-spider")
    return [predator, createRabbit(293, 176), createRabbit(286, 225)];
  return undefined;
}

export function raptorModelReviewRecipe(caseId: string) {
  const scene = naturalLandscapeRecipe(caseId, "balanced");
  for (const actor of scene.actors ?? []) delete actor.naturalSpawnId;
  return { ...scene, nativeProps: [] };
}

export function isWildlifeBehaviorModelReview(type: string, caseId: string): boolean {
  return isCatModelReview(type, caseId) || isWildlifeWorkModelReviewCase(caseId);
}

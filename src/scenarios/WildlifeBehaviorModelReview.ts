import { faunaProfile } from "../wildlife/Fauna.js";
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
  return /^behavior-(?:crow|raven|hummingbird|peacock|bee)$/.test(caseId);
}

export function isRaptorModelReviewCase(caseId: string): boolean {
  return /^(?:eagle|hawk|owl|secretary-bird)$/.test(caseId);
}

export function isFelidModelReviewCase(caseId: string): boolean {
  return /^(?:bobcat|lynx|cheetah|jaguar|leopard|lion|tiger|panther)$/.test(caseId);
}

export function felidReviewActors(type: string, caseId: string) {
  const hunter = predatorProfile(type);
  if (hunter?.species !== caseId || !isFelidModelReviewCase(caseId)) return undefined;
  return [createPredator(hunter.species, 240, 176), createRabbit(293, 176), createRabbit(286, 225)];
}

export function raptorModelReviewRecipe(caseId: string) {
  const scene = naturalLandscapeRecipe(caseId, "balanced");
  for (const actor of scene.actors ?? []) delete actor.naturalSpawnId;
  return { ...scene, nativeProps: [] };
}

export function isWildlifeBehaviorModelReview(type: string, caseId: string): boolean {
  return isCatModelReview(type, caseId) || isWildlifeWorkModelReviewCase(caseId);
}

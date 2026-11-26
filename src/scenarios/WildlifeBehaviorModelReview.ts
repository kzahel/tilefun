import { faunaProfile } from "../wildlife/Fauna.js";

export function isCatModelReview(type: string, caseId: string): boolean {
  return (
    /^behavior-cat(?:-ginger|-black)?$/.test(caseId) &&
    faunaProfile(type)?.species === caseId.slice(9)
  );
}

export function isBirdWorkModelReviewCase(caseId: string): boolean {
  return /^behavior-(?:crow|raven|hummingbird|peacock)$/.test(caseId);
}

export function isRaptorModelReviewCase(caseId: string): boolean {
  return /^(?:eagle|hawk|owl|secretary-bird)$/.test(caseId);
}

export function isWildlifeBehaviorModelReview(type: string, caseId: string): boolean {
  return isCatModelReview(type, caseId) || isBirdWorkModelReviewCase(caseId);
}

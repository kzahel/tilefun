import { ENTITY_DEFS } from "../entities/EntityDefs.js";
import defaultModels from "./default-models.json" with { type: "json" };
import reviews from "./model-reviews.json" with { type: "json" };

export interface WildlifeModelReview {
  id: string;
  type: string;
  name: string;
  batch: string;
  lab: string;
  scale: number;
  topDown: { width: number; height: number };
  actions?: Record<string, string>;
  classicTravel?: string;
  files: Record<string, string | undefined>;
}

export const WILDLIFE_MODEL_REVIEWS: readonly WildlifeModelReview[] = reviews;

const reviewsById = new Map(WILDLIFE_MODEL_REVIEWS.map((review) => [review.id, review]));
export const WILDLIFE_DEFAULT_MODELS = Object.entries(defaultModels).map(([type, id]) => {
  const review = reviewsById.get(id);
  if (review?.type !== type) throw new Error(`Invalid default wildlife model: ${type} (${id})`);
  return review;
});

export const WILDLIFE_MODEL_REVIEW_PREFIX = "pattern:wildlife-3d-";

export function wildlifeModelClips(type: string, classicTravel?: string) {
  const sprite = ENTITY_DEFS[type]?.sprite;
  if (!sprite) return undefined;
  if (sprite.clips) return sprite.clips;
  if (!classicTravel) return undefined;
  const { frameCount, frameDuration } = sprite;
  return [
    { name: "idle", start: 0, count: 1, frameDuration, loop: true },
    { name: classicTravel, start: 0, count: frameCount, frameDuration, loop: true },
  ];
}

/** These classic sheets mirror one side pose when the actor turns left. */
export function classicWildlifeSideProfile(type: string): boolean {
  return type === "cow" || type === "chicken" || /^fish[123]$/.test(type);
}

export function wildlifeModelReviewPath(id: string, filename: string): string {
  return `demos/wildlife-3d/${id}/${filename}`;
}

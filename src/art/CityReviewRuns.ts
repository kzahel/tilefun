/** Shared routing metadata for independent city review queues. */
export const CITY_REVIEW_RUNS = {
  parking: { name: "Small parking lots", version: "regional-v7", recipe: "city-places-v7" },
} as const;
export function isCityReviewRun(value: string): value is keyof typeof CITY_REVIEW_RUNS {
  return Object.hasOwn(CITY_REVIEW_RUNS, value);
}

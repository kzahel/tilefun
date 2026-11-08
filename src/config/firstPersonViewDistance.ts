/** View distance choices (tactical 230): fog end and streamed radius in world pixels. */
export const VIEW_DISTANCES = { near: 400, medium: 800, far: 1600 } as const;
export type FirstPersonViewDistance = keyof typeof VIEW_DISTANCES;
export const DEFAULT_VIEW_DISTANCE: FirstPersonViewDistance = "medium";

/** A saved or typed choice, falling back to the default. */
export function viewDistance(value: unknown): FirstPersonViewDistance {
  return typeof value === "string" && Object.hasOwn(VIEW_DISTANCES, value)
    ? (value as FirstPersonViewDistance)
    : DEFAULT_VIEW_DISTANCE;
}

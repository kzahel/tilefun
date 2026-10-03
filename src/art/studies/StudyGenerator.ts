import type { DenseDistrictStrategy } from "../../generation/regional/DenseDistrictStrategy.js";

/** Bounded authoring/test adapter, deliberately without a saved-world descriptor. */
export function studyGenerator<T extends DenseDistrictStrategy>(terrain: T) {
  return {
    terrain,
    placements: (cx: number, cy: number, _processed: ReadonlySet<string>) => ({
      placements: terrain.placements(cx, cy),
      newIntersectionKeys: [],
    }),
    actors: (cx: number, cy: number) => terrain.actors(cx, cy),
  };
}

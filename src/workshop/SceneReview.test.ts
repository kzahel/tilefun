import { describe, expect, it } from "vitest";
import { ALL_DENSE_REVIEW_CASES, denseReviewRun } from "../art/DenseDistrictShowcase.js";
import { artReviewDefinitions } from "./ReviewCandidates.js";
import { reviewUnits, SCENE_ROOTS, scenePath } from "./SceneReview.js";
import type { WorkshopCandidate } from "./WorkshopTypes.js";

describe("one scene per neighborhood review", () => {
  it("keeps crop history but chooses one matching whole world per batch", () => {
    for (const [batch, id] of Object.entries(SCENE_ROOTS)) {
      const definition = ALL_DENSE_REVIEW_CASES.find((c) => c.id === id);
      expect(definition?.window).toBe("whole");
      expect(definition && denseReviewRun(definition)).toBe(batch);
    }
    const candidates = artReviewDefinitions()
      .filter((d) => d.scene === "district")
      .map((d) => ({
        id: d.id,
        batchId: d.batchId,
        review: { scene: "district", caseId: d.prefab },
      })) as WorkshopCandidate[];
    expect(reviewUnits(candidates)).toHaveLength(Object.keys(SCENE_ROOTS).length);
    const crop = candidates.find((c) => c.id === "district:district-v8-square")!;
    expect(scenePath(crop)).toBe("/scene/district-v8-public-block?focus=district-v8-square");
  });
});

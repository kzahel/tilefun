import { interiorFingerprint, renderInteriorCandidate } from "../interiors/review/ReviewRender.js";

export { interiorFingerprint, renderInteriorCandidate } from "../interiors/review/ReviewRender.js";

import { required } from "../art/ArtCatalog.js";
import { sha256 } from "../art/ArtSource.js";
import { loadModernInteriorsAtlasIndex } from "../assets/ModernInteriorsAtlasIndex.js";
import { FURNITURE_CATALOG_VERSION } from "../interiors/FurnitureCatalog.js";
import { FurnitureMotion, MOTION_SCENES } from "../interiors/FurnitureMotion.js";
import { motionSceneSignature } from "../interiors/MotionReview.js";
import spriteIndexUrl from "../interiors/review/assets/review-sprites.json?url";
import spriteUrl from "../interiors/review/assets/review-sprites.png?url";
import { REVIEW_STAGES, reviewCases } from "../interiors/review/ReviewCases.js";
import type { ReviewBatch, WorkshopCandidate } from "./WorkshopTypes.js";

let atlasPromise: Promise<HTMLImageElement> | undefined;
export function loadReviewAtlas() {
  atlasPromise ??= (async () => {
    const image = new Image();
    image.src = spriteUrl;
    await Promise.all([image.decode(), loadModernInteriorsAtlasIndex(spriteIndexUrl)]);
    return image;
  })();
  return atlasPromise;
}
export const INTERIOR_BATCHES: ReviewBatch[] = REVIEW_STAGES.map((name, stage) => ({
  id: `rooms-${stage}`,
  name,
  description: "Generated interior cases rendered with the shared room compiler.",
  toolId: "rooms",
}));
export async function buildInteriorCandidates() {
  const atlas = await loadReviewAtlas(),
    canvas = document.createElement("canvas"),
    result: WorkshopCandidate[] = [];
  for (const c of reviewCases()) {
    const candidate: WorkshopCandidate = {
      id: c.id,
      batchId: `rooms-${c.stage}`,
      name: c.name,
      prompt: "Review the room and doorway joins. Tap the render to pin a problem.",
      url: `/tilefun/interior-review.html?stage=${c.stage}&unchecked=0&case=${c.id}`,
      kind: "interior",
      fingerprint: "",
      interior: {
        caseId: c.id,
        name: c.name,
        sketch: c.sketch,
        fingerprint: "",
        ...(c.profiles ? { profiles: c.profiles } : {}),
        ...(c.furniture
          ? { furniture: c.furniture, furnitureCatalogVersion: FURNITURE_CATALOG_VERSION }
          : {}),
      },
    };
    try {
      renderInteriorCandidate(canvas, c, atlas);
      candidate.fingerprint = await interiorFingerprint(canvas, c);
      required(candidate.interior).fingerprint = candidate.fingerprint;
    } catch (error) {
      candidate.excluded = String(error);
    }
    result.push(candidate);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  // Movement approval is about scene configuration and physics, not a single pose.
  for (const scene of MOTION_SCENES) {
    const model = new FurnitureMotion(scene.furniture);
    const signature = motionSceneSignature(model.furniture, model.bodies, model.gravityScale);
    result.push({
      id: `furniture-motion-${scene.id}`,
      batchId: "motion",
      name: scene.name,
      prompt:
        "Walk and jump before judging movement. Edited settings are reviewed in the movement tool.",
      url: `/tilefun/furniture-playtest.html?scene=${scene.id}`,
      kind: "motion",
      fingerprint: await sha256(new TextEncoder().encode(signature)),
      sceneSignature: signature,
    });
  }
  return result;
}

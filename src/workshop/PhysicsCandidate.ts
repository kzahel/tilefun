import { sha256 } from "../art/ArtSource.js";
import { COOP_CASES, coopRecipe } from "../scenarios/CoopRecipe.js";
import { ENGINE_REVIEW_REVISION } from "./EngineReviewRevision.js";
import type { WorkshopCandidate } from "./WorkshopTypes.js";

export async function buildPhysicsCandidate(): Promise<WorkshopCandidate> {
  return {
    id: "geometry:rapier-physics-v1",
    batchId: "physics-prototype",
    kind: "geometry",
    name: "Co-op physics laboratory",
    prompt:
      "Two ordinary clients share one temporary Realm Worker, the game’s fixed shared physics step, normal binary frames and private prediction. Inspect pushing, head support, reversal and ordered guest latency; pause, step, reset or save/reload.",
    url: "/tilefun/workshop.html#/tool/physics",
    excluded: "Interactive diagnostic; not an immutable art approval snapshot.",
    fingerprint: await sha256(
      new TextEncoder().encode(
        JSON.stringify({
          recipes: COOP_CASES.map(coopRecipe),
          engine: ENGINE_REVIEW_REVISION,
        }),
      ),
    ),
  };
}

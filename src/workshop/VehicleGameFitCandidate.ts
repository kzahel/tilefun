import v1 from "../../public/assets/models/vehicles/review/game-fit-v1/review.json";
import v2 from "../../public/assets/models/vehicles/review/game-fit-v2/review.json";
import { sha256 } from "../art/ArtSource.js";
import type { WorkshopCandidate } from "./WorkshopTypes.js";

/** Frozen engine-camera comparison; never substitutes for retained GLB review. */
export async function buildVehicleGameFitCandidate(
  version: "v1" | "v2" = "v2",
): Promise<WorkshopCandidate> {
  const review = version === "v1" ? v1 : v2;
  for (const file of review.identity.files) {
    const response = await fetch(`/tilefun/${file.url}`);
    if (
      !response.ok ||
      (await sha256(new Uint8Array(await response.arrayBuffer()))) !== file.sha256
    )
      throw Error(`Vehicle game-fit evidence missing or changed: ${file.url}`);
  }
  const fingerprint = await sha256(new TextEncoder().encode(JSON.stringify(review.identity)));
  if (fingerprint !== review.candidateFingerprint) throw Error("Vehicle game-fit identity changed");
  return {
    id: review.candidateId,
    batchId: "authored-vehicles",
    name: `All vehicles · game-camera fit ${version}`,
    prompt:
      "Compare native heights, before/after proportions and diagonal grounding, then drive and turn in the game.",
    url: `/tilefun/assets/models/vehicles/review/game-fit-${version}/`,
    kind: "projection",
    fingerprint,
    sourceFingerprint: review.identity.sourceFingerprint,
    excluded: "Engine presentation fit; exact live appearance inspection remains open.",
  };
}

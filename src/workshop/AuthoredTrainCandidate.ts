import v1 from "../../public/assets/models/trains/review/blue-v1/review.json";
import v3 from "../../public/assets/models/trains/review/blue-v3/review.json";
import { sha256 } from "../art/ArtSource.js";
import type { WorkshopCandidate } from "./WorkshopTypes.js";

/** Frozen model/motion evidence; live moving-art acceptance remains separate. */
export async function buildAuthoredTrainCandidate(
  revision: "v1" | "v3" = "v3",
): Promise<WorkshopCandidate> {
  const review = revision === "v1" ? v1 : v3;
  for (const file of review.identity.files) {
    const response = await fetch(`/tilefun/${file.url}`);
    if (
      !response.ok ||
      (await sha256(new Uint8Array(await response.arrayBuffer()))) !== file.sha256
    )
      throw Error(`Retained train review asset missing or changed: ${file.url}`);
  }
  const fingerprint = await sha256(new TextEncoder().encode(JSON.stringify(review.identity)));
  if (fingerprint !== review.candidateFingerprint)
    throw Error("Retained blue train identity changed");
  return {
    id: review.candidateId,
    batchId: "authored-trains",
    name: `Blue train · three authored carriages ${revision}`,
    prompt:
      "Compare the 4×2 carriage views, then watch fixed-camera curves, joins and actual reversal. Native service spacing stays unchanged.",
    url: `/tilefun/assets/models/trains/review/blue-${revision}/`,
    kind: "projection",
    fingerprint,
    sourceFingerprint: review.identity.sourceFingerprint,
    ...(revision === "v1"
      ? {
          excluded:
            "Historical train prototype; the reviewed v3 carriages are active in mesh mode.",
        }
      : {}),
  };
}

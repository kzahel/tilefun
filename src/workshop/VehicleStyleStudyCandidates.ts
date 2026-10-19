import study from "../../public/demos/vehicle-style-study/manifest.json";
import { sha256 } from "../art/ArtSource.js";
import type { WorkshopCandidate } from "./WorkshopTypes.js";

/** Frozen offline workflow comparisons; these do not promote runtime artwork. */
export async function buildVehicleStyleStudyCandidates(): Promise<WorkshopCandidate[]> {
  const candidates: WorkshopCandidate[] = [];
  for (const route of study.routes) {
    for (const file of route.files) {
      const response = await fetch(`/tilefun/${file.url}`);
      if (
        !response.ok ||
        (await sha256(new Uint8Array(await response.arrayBuffer()))) !== file.sha256
      ) {
        throw Error(`Sports-car study evidence missing or changed: ${file.url}`);
      }
    }
    const fingerprint = await sha256(new TextEncoder().encode(JSON.stringify(route)));
    candidates.push({
      id: `projection:sports-car-study-${route.id}-v1`,
      batchId: "vehicle-style-study",
      name: `Sports car · ${route.title}`,
      prompt:
        "Compare native pixels, diagonals and raw renders beside the existing vehicle sprites.",
      url: `/tilefun/demos/vehicle-style-study/index.html#${route.id}`,
      kind: "projection",
      fingerprint,
      sourceFingerprint: fingerprint,
      excluded: "Offline authoring experiment; no gameplay integration or production art approval.",
    });
  }
  return candidates;
}

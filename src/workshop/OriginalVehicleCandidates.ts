import originals from "../../public/demos/original-vehicles/manifest.json";
import { sha256 } from "../art/ArtSource.js";
import type { WorkshopCandidate } from "./WorkshopTypes.js";

/** Frozen original-family previews; registering a candidate does not activate it. */
export async function buildOriginalVehicleCandidates(): Promise<WorkshopCandidate[]> {
  const candidates: WorkshopCandidate[] = [];
  for (const candidate of originals.candidates) {
    for (const file of candidate.files) {
      const response = await fetch(`/tilefun/${file.url}`);
      if (
        !response.ok ||
        (await sha256(new Uint8Array(await response.arrayBuffer()))) !== file.sha256
      ) {
        throw Error(`Original vehicle evidence missing or changed: ${file.url}`);
      }
    }
    const fingerprint = await sha256(new TextEncoder().encode(JSON.stringify(candidate)));
    candidates.push({
      id: `projection:original-vehicle-${candidate.id}`,
      batchId: "original-vehicles",
      name: candidate.title,
      prompt:
        "Review the shape, palette, outlines and fender coverage at game scale and intermediate angles.",
      url: `/tilefun/${candidate.url}`,
      kind: "projection",
      fingerprint,
      sourceFingerprint: fingerprint,
      excluded:
        "Original vehicle awaiting owner appearance review; gameplay activation is a separate checkpoint.",
    });
  }
  return candidates;
}

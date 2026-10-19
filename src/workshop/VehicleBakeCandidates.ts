import study from "../../public/demos/vehicle-bake/manifest.json";
import { sha256 } from "../art/ArtSource.js";
import type { WorkshopCandidate } from "./WorkshopTypes.js";

/** Exact low-poly exports and their shared-engine pixel evidence; no art promotion. */
export async function buildVehicleBakeCandidates(): Promise<WorkshopCandidate[]> {
  const candidates: WorkshopCandidate[] = [];
  for (const candidate of study.candidates) {
    for (const file of candidate.files) {
      const response = await fetch(`/tilefun/${file.url}`);
      if (
        !response.ok ||
        (await sha256(new Uint8Array(await response.arrayBuffer()))) !== file.sha256
      ) {
        throw Error(`Low-poly vehicle evidence missing or changed: ${file.url}`);
      }
    }
    const fingerprint = await sha256(new TextEncoder().encode(JSON.stringify(candidate)));
    candidates.push({
      id: `projection:red-coupe-low-poly-${candidate.id}`,
      batchId: "vehicle-bake",
      name: `Red coupe · ${candidate.title}`,
      prompt:
        "Compare the chosen pixel art with the actual textured low-poly GLB, including diagonal views and wheel roll.",
      url: `/tilefun/demos/vehicle-bake/index.html?candidate=${encodeURIComponent(candidate.id)}`,
      kind: "projection",
      fingerprint,
      sourceFingerprint: fingerprint,
      excluded:
        "Low-poly authoring pilot awaiting owner style/budget review; no gameplay activation.",
    });
  }
  return candidates;
}

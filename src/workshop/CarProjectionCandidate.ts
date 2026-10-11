import ambulanceReview from "../../public/assets/models/vehicles/review/ambulance-v1/review.json" with {
  type: "json",
};
import ambulanceLightsReview from "../../public/assets/models/vehicles/review/ambulance-v2/review.json" with {
  type: "json",
};
import { sha256 } from "../art/ArtSource.js";
import { CAR_PROXY, carProxyPatches } from "../projection/CarProxy.js";
import geometrySource from "../projection/CarProxy.ts?raw";
import rendererSource from "../projection/CarProxyScene.ts?raw";
import textureSource from "../projection/ProxyTexture.ts?raw";
import type { WorkshopCandidate } from "./WorkshopTypes.js";

/** Discoverable experiment identity, deliberately not an approvable GPU snapshot. */
export async function buildCarProjectionCandidate(): Promise<WorkshopCandidate> {
  const fingerprint = await sha256(
    new TextEncoder().encode(
      JSON.stringify({
        asset: CAR_PROXY,
        patches: carProxyPatches(),
        geometrySource,
        rendererSource,
        textureSource,
      }),
    ),
  );
  return {
    id: "projection:compact-car-v1",
    batchId: "car-projection",
    name: "Blue compact car · projected 3D proxy",
    prompt:
      "Orbit the fitted surfaces, compare the source image and inspect approved collision bounds. This experiment has no gameplay promotion or approval action.",
    url: "/tilefun/workshop.html#/tool/car-projection",
    kind: "projection",
    sourceFingerprint: CAR_PROXY.sourceFingerprint,
    fingerprint,
    excluded: "Exploratory orbit view; not an immutable approval snapshot.",
  };
}

/** Exact retained comparison sheets stay discoverable without granting art approval. */
export async function buildAuthoredVehicleCandidates(): Promise<WorkshopCandidate[]> {
  const candidates: WorkshopCandidate[] = [];
  for (const review of [ambulanceReview, ambulanceLightsReview]) {
    for (const file of review.identity.files) {
      const response = await fetch(`/tilefun/${file.url}`);
      if (!response.ok) throw new Error(`Missing retained vehicle review asset: ${file.url}`);
      if ((await sha256(new Uint8Array(await response.arrayBuffer()))) !== file.sha256)
        throw new Error(`Retained vehicle review asset changed: ${file.url}`);
    }
    const fingerprint = await sha256(new TextEncoder().encode(JSON.stringify(review.identity)));
    if (fingerprint !== review.candidateFingerprint)
      throw new Error(`Retained vehicle capture changed: ${review.candidateId}`);
    candidates.push({
      id: review.candidateId,
      batchId: "authored-vehicles",
      name: `Ambulance · authored model ${review.identity.revision}`,
      prompt:
        "Compare the original sprites above matched Blender renders, then inspect the roof, windows, wheels and rear fittings in the additional angles.",
      url: `/tilefun/assets/models/vehicles/review/ambulance-${review.identity.revision}/`,
      kind: "projection",
      fingerprint,
      sourceFingerprint: review.identity.sourceFingerprint,
      excluded:
        "Retained model inspection; engine qualification and production art approval remain pending.",
    });
  }
  return candidates;
}

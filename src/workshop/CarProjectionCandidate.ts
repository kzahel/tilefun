import ambulanceReview from "../../public/assets/models/vehicles/review/ambulance-v1/review.json" with {
  type: "json",
};
import ambulanceLightsReview from "../../public/assets/models/vehicles/review/ambulance-v2/review.json" with {
  type: "json",
};
import bus1Review from "../../public/assets/models/vehicles/review/bus-1-v1/review.json" with {
  type: "json",
};
import bus2Review from "../../public/assets/models/vehicles/review/bus-2-v1/review.json" with {
  type: "json",
};
import bus3Review from "../../public/assets/models/vehicles/review/bus-3-v1/review.json" with {
  type: "json",
};
import bus4Review from "../../public/assets/models/vehicles/review/bus-4-v1/review.json" with {
  type: "json",
};
import bus5Review from "../../public/assets/models/vehicles/review/bus-5-v1/review.json" with {
  type: "json",
};
import bus6Review from "../../public/assets/models/vehicles/review/bus-6-v1/review.json" with {
  type: "json",
};
import large0Review from "../../public/assets/models/vehicles/review/car-7-v1/review.json" with {
  type: "json",
};
import large1Review from "../../public/assets/models/vehicles/review/car-8-v1/review.json" with {
  type: "json",
};
import large2Review from "../../public/assets/models/vehicles/review/car-9-v1/review.json" with {
  type: "json",
};
import large3Review from "../../public/assets/models/vehicles/review/car-10-v1/review.json" with {
  type: "json",
};
import large4Review from "../../public/assets/models/vehicles/review/car-11-v1/review.json" with {
  type: "json",
};
import large6Review from "../../public/assets/models/vehicles/review/car-13-v1/review.json" with {
  type: "json",
};
import large7Review from "../../public/assets/models/vehicles/review/car-14-v1/review.json" with {
  type: "json",
};
import large8Review from "../../public/assets/models/vehicles/review/car-15-v1/review.json" with {
  type: "json",
};
import large9Review from "../../public/assets/models/vehicles/review/car-16-v1/review.json" with {
  type: "json",
};
import large10Review from "../../public/assets/models/vehicles/review/car-17-v1/review.json" with {
  type: "json",
};
import large11Review from "../../public/assets/models/vehicles/review/car-18-v1/review.json" with {
  type: "json",
};
import large12Review from "../../public/assets/models/vehicles/review/car-19-v1/review.json" with {
  type: "json",
};
import large13Review from "../../public/assets/models/vehicles/review/car-20-v1/review.json" with {
  type: "json",
};
import large14Review from "../../public/assets/models/vehicles/review/car-21-v1/review.json" with {
  type: "json",
};
import large15Review from "../../public/assets/models/vehicles/review/car-22-v1/review.json" with {
  type: "json",
};
import large16Review from "../../public/assets/models/vehicles/review/car-23-v1/review.json" with {
  type: "json",
};
import large17Review from "../../public/assets/models/vehicles/review/car-24-v1/review.json" with {
  type: "json",
};
import large18Review from "../../public/assets/models/vehicles/review/car-25-v1/review.json" with {
  type: "json",
};
import large19Review from "../../public/assets/models/vehicles/review/car-26-v1/review.json" with {
  type: "json",
};
import compactCyanReview from "../../public/assets/models/vehicles/review/compact-3-v1/review.json" with {
  type: "json",
};
import compactOrangeReview from "../../public/assets/models/vehicles/review/compact-5-v1/review.json" with {
  type: "json",
};
import compactSilverReview from "../../public/assets/models/vehicles/review/compact-6-v1/review.json" with {
  type: "json",
};
import fireReview from "../../public/assets/models/vehicles/review/fire-truck-ladder-1-v1/review.json" with {
  type: "json",
};
import fireWheelsReview from "../../public/assets/models/vehicles/review/fire-truck-ladder-1-v2/review.json" with {
  type: "json",
};
import garbageReview from "../../public/assets/models/vehicles/review/garbage-truck-green-v1/review.json" with {
  type: "json",
};
import policeReview from "../../public/assets/models/vehicles/review/police-car-v1/review.json" with {
  type: "json",
};
import large5Review from "../../public/assets/models/vehicles/review/sedan-12-v1/review.json" with {
  type: "json",
};
import sedanBeigeReview from "../../public/assets/models/vehicles/review/unindexed-sedan-beige-v1/review.json" with {
  type: "json",
};
import sedanCyanReview from "../../public/assets/models/vehicles/review/unindexed-sedan-cyan-v1/review.json" with {
  type: "json",
};
import sedanDarkReview from "../../public/assets/models/vehicles/review/unindexed-sedan-dark-v1/review.json" with {
  type: "json",
};
import sedanOliveReview from "../../public/assets/models/vehicles/review/unindexed-sedan-olive-v1/review.json" with {
  type: "json",
};
import sedanOrangeReview from "../../public/assets/models/vehicles/review/unindexed-sedan-orange-v1/review.json" with {
  type: "json",
};
import sedanRedReview from "../../public/assets/models/vehicles/review/unindexed-sedan-red-v1/review.json" with {
  type: "json",
};
import sedanSilverReview from "../../public/assets/models/vehicles/review/unindexed-sedan-silver-v1/review.json" with {
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
  const reviews = [
    { review: large0Review, name: "Car 7" },
    { review: large1Review, name: "Car 8" },
    { review: large2Review, name: "Car 9" },
    { review: large3Review, name: "Car 10" },
    { review: large4Review, name: "Car 11" },
    { review: large5Review, name: "Beige sedan 12" },
    { review: large6Review, name: "Car 13" },
    { review: large7Review, name: "Car 14" },
    { review: large8Review, name: "Car 15" },
    { review: large9Review, name: "Car 16" },
    { review: large10Review, name: "Car 17" },
    { review: large11Review, name: "Car 18" },
    { review: large12Review, name: "Car 19" },
    { review: large13Review, name: "Car 20" },
    { review: large14Review, name: "Car 21" },
    { review: large15Review, name: "Car 22" },
    { review: large16Review, name: "Car 23" },
    { review: large17Review, name: "Car 24" },
    { review: large18Review, name: "Car 25" },
    { review: large19Review, name: "Car 26" },
    { review: bus1Review, name: "Bus 1" },
    { review: bus2Review, name: "Bus 2" },
    { review: bus3Review, name: "Bus 3" },
    { review: bus4Review, name: "Bus 4" },
    { review: bus5Review, name: "Bus 5" },
    { review: bus6Review, name: "Bus 6" },
    { review: ambulanceReview, name: "Ambulance" },
    { review: ambulanceLightsReview, name: "Ambulance" },
    { review: policeReview, name: "Police car" },
    { review: fireReview, name: "Fire truck · stowed ladder" },
    { review: fireWheelsReview, name: "Fire truck · stowed ladder" },
    { review: garbageReview, name: "Green garbage truck" },
    { review: compactCyanReview, name: "Cyan compact" },
    { review: compactOrangeReview, name: "Orange compact" },
    { review: compactSilverReview, name: "Silver compact" },
    { review: sedanRedReview, name: "Red sedan" },
    { review: sedanBeigeReview, name: "Beige sedan" },
    { review: sedanCyanReview, name: "Cyan sedan" },
    { review: sedanOrangeReview, name: "Orange sedan" },
    { review: sedanSilverReview, name: "Silver sedan" },
    { review: sedanOliveReview, name: "Olive sedan" },
    { review: sedanDarkReview, name: "Dark sedan" },
  ];
  for (const { review, name } of reviews) {
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
      name: `${name} · authored model ${review.identity.revision}`,
      prompt:
        "Compare the original sprites above matched Blender renders, then inspect the roof, windows, wheels and rear fittings in the additional angles.",
      url: `/tilefun/assets/models/vehicles/review/${review.identity.assetId}-${review.identity.revision}/`,
      kind: "projection",
      fingerprint,
      sourceFingerprint: review.identity.sourceFingerprint,
      excluded:
        "Retained model inspection; engine qualification and production art approval remain pending.",
    });
  }
  return candidates;
}

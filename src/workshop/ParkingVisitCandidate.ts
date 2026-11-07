import { sha256 } from "../art/ArtSource.js";
import { shoppingRecipe } from "../scenarios/RoadTrafficRecipe.js";
import { deferredVehicleCandidate } from "./DeferredVehicleCandidate.js";
import { ENGINE_REVIEW_REVISION } from "./EngineReviewRevision.js";
import type { WorkshopCandidate } from "./WorkshopTypes.js";

/** Shopping visits (225) in the world geometry lab. The generated-city capture
 * remains a deferred entry until a fresh city review scene is built. */
export async function buildParkingVisitCandidate(city = false): Promise<WorkshopCandidate> {
  if (city)
    return deferredVehicleCandidate(
      "geometry:city-shopping-v1",
      "Generated city · shopping visits (deferred)",
      "/tilefun/workshop.html#/tool/parking-lab?play=1&city=1",
      "parking-visits",
    );
  const recipe = shoppingRecipe();
  return {
    id: "geometry:parking-visits-v1",
    batchId: "parking-visits",
    kind: "geometry",
    name: "Parking and shoppers",
    prompt:
      "A compact on the boulevard turns into the lot, parks, and its shopper walks into the shop and back before the car rejoins the boulevard. Shared game physics; no art promotion.",
    url: "/tilefun/workshop.html?geometry=shopping#/tool/world-geometry",
    fingerprint: await sha256(
      new TextEncoder().encode(JSON.stringify({ recipe, engine: ENGINE_REVIEW_REVISION })),
    ),
    excluded: "Interactive engine experiment; not an immutable art approval snapshot.",
  };
}

import { sha256 } from "../art/ArtSource.js";
import { vehicleDynamicsRecipe } from "../scenarios/VehicleDynamicsRecipe.js";
import { ENGINE_REVIEW_REVISION } from "./EngineReviewRevision.js";
import type { WorkshopCandidate } from "./WorkshopTypes.js";

/** The restored playable dump bed (222), in the ordinary vehicle dynamics course. */
export async function buildTruckBedCandidate(): Promise<WorkshopCandidate> {
  const recipe = vehicleDynamicsRecipe("compact-1", "bed");
  return {
    id: "geometry:truck-bed-v2",
    batchId: "world-geometry",
    kind: "geometry",
    name: "Tipping dump-truck bed",
    prompt:
      "Jump into the hollow bed, ride while driving and turning, then Tip bed / Lower bed (F, D-pad down or touch). Balls should stay inside while driving and roll out of the open tailgate when tipped. Shared game physics; existing v2 truck model; no art promotion.",
    url: "/tilefun/workshop.html?geometry=car-dynamics&route=bed#/tool/world-geometry",
    fingerprint: await sha256(
      new TextEncoder().encode(
        JSON.stringify({ recipe, bed: 222, engine: ENGINE_REVIEW_REVISION }),
      ),
    ),
    excluded: "Interactive engine experiment; not an immutable art approval snapshot.",
  };
}

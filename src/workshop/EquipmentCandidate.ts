import { sha256 } from "../art/ArtSource.js";
import { type DYNAMICS_STARTS, vehicleDynamicsRecipe } from "../scenarios/VehicleDynamicsRecipe.js";
import { ENGINE_REVIEW_REVISION } from "./EngineReviewRevision.js";
import type { WorkshopCandidate } from "./WorkshopTypes.js";

/** Restored vehicle equipment (222, 224) in the ordinary vehicle dynamics course. */
export async function equipmentCandidate(
  id: string,
  name: string,
  route: keyof typeof DYNAMICS_STARTS,
  prompt: string,
): Promise<WorkshopCandidate> {
  const recipe = vehicleDynamicsRecipe("compact-1", route);
  return {
    id,
    batchId: "world-geometry",
    kind: "geometry",
    name,
    prompt: `${prompt} Shared game physics and existing models; no art promotion.`,
    url: `/tilefun/workshop.html?geometry=car-dynamics&route=${route}#/tool/world-geometry`,
    fingerprint: await sha256(
      new TextEncoder().encode(JSON.stringify({ recipe, route, engine: ENGINE_REVIEW_REVISION })),
    ),
    excluded: "Interactive engine experiment; not an immutable art approval snapshot.",
  };
}

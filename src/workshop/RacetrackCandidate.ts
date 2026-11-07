import { sha256 } from "../art/ArtSource.js";
import { racetrackRecipe } from "../scenarios/RoadTrafficRecipe.js";
import { ENGINE_REVIEW_REVISION } from "./EngineReviewRevision.js";
import type { WorkshopCandidate } from "./WorkshopTypes.js";

/** Restored speedway racers (225): two clockwise rings of ordinary sports cars. */
export async function buildRacetrackCandidate(): Promise<WorkshopCandidate> {
  const recipe = racetrackRecipe();
  return {
    id: "geometry:racetrack-traffic-v1",
    batchId: "world-geometry",
    kind: "geometry",
    name: "Speedway racers",
    prompt:
      "Eight racers lap two rings of a speedway oval at race speed. Walk onto the track to stop them; drive one off with E. Shared game physics and existing models; no art promotion.",
    url: "/tilefun/workshop.html?geometry=racetrack#/tool/world-geometry",
    fingerprint: await sha256(
      new TextEncoder().encode(JSON.stringify({ recipe, engine: ENGINE_REVIEW_REVISION })),
    ),
    excluded: "Interactive engine experiment; not an immutable art approval snapshot.",
  };
}

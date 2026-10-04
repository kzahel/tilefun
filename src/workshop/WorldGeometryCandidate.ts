import { sha256 } from "../art/ArtSource.js";
import collision from "../entities/collision.ts?raw";
import movement from "../physics/PlayerMovement.ts?raw";
import queries from "../physics/SimulationEnvironment.ts?raw";
import geometry from "../physics/SurfacePatch.ts?raw";
import support from "../physics/surfaceHeight.ts?raw";
import presentation from "../rendering/SurfacePresentation.ts?raw";
import { worldGeometryRecipe } from "../scenarios/WorldGeometryRecipe.js";
import type { WorkshopCandidate } from "./WorkshopTypes.js";

export async function buildWorldGeometryCandidate(): Promise<WorkshopCandidate> {
  const fingerprint = await sha256(
    new TextEncoder().encode(
      JSON.stringify({
        recipe: worldGeometryRecipe(),
        collision,
        movement,
        queries,
        support,
        geometry,
        presentation,
      }),
    ),
  );
  return {
    id: "geometry:deck-ramp-v1",
    batchId: "world-geometry",
    kind: "geometry",
    name: "Ramp, raised deck and lower passage",
    prompt:
      "Walk above and below the deck, jump into its underside and switch cutaway visibility. Schematic engine proof; no art promotion.",
    url: "/tilefun/workshop.html#/tool/world-geometry",
    fingerprint,
    excluded: "Interactive engine experiment; not an immutable art approval snapshot.",
  };
}

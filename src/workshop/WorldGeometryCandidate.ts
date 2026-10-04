import { sha256 } from "../art/ArtSource.js";
import collision from "../entities/collision.ts?raw";
import movement from "../physics/PlayerMovement.ts?raw";
import queries from "../physics/SimulationEnvironment.ts?raw";
import geometry from "../physics/SurfacePatch.ts?raw";
import support from "../physics/surfaceHeight.ts?raw";
import excavation from "../physics/TerrainExcavation.ts?raw";
import presentation from "../rendering/SurfacePresentation.ts?raw";
import { undergroundGarageRecipe } from "../scenarios/UndergroundGarageRecipe.js";
import { worldGeometryRecipe } from "../scenarios/WorldGeometryRecipe.js";
import type { WorkshopCandidate } from "./WorkshopTypes.js";

export async function buildWorldGeometryCandidate(garage = false): Promise<WorkshopCandidate> {
  const fingerprint = await sha256(
    new TextEncoder().encode(
      JSON.stringify({
        recipe: garage ? undergroundGarageRecipe() : worldGeometryRecipe(),
        ...(garage ? { excavation } : {}),
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
    id: garage ? "geometry:underground-garage-v1" : "geometry:deck-ramp-v1",
    batchId: "world-geometry",
    kind: "geometry",
    name: garage
      ? "Underground garage, entrance and usable street"
      : "Ramp, raised deck and lower passage",
    prompt: garage
      ? "Walk down through an opening in terrain into a covered garage, return continuously, and compare street/garage space identity and reload."
      : "Walk above and below the deck, jump into its underside and switch cutaway visibility. Schematic engine proof; no art promotion.",
    url: garage
      ? "/tilefun/workshop.html?geometry=garage#/tool/world-geometry"
      : "/tilefun/workshop.html#/tool/world-geometry",
    fingerprint,
    excluded: "Interactive engine experiment; not an immutable art approval snapshot.",
  };
}

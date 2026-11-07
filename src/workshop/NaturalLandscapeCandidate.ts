import type { ArtCatalog } from "../art/ArtCatalog.js";
import { sha256 } from "../art/ArtSource.js";
import {
  LANDSCAPE_PROFILES,
  type LandscapeProfile,
} from "../generation/regional/NaturalLandscape.js";
import {
  NATURAL_CASES,
  naturalCase,
  naturalExplorerUrl,
  naturalLandscapeRecipe,
} from "../scenarios/NaturalLandscapeRecipe.js";
import { ENGINE_REVIEW_REVISION } from "./EngineReviewRevision.js";
import type { WorkshopCandidate } from "./WorkshopTypes.js";

export async function buildNaturalCandidate(
  id: string,
  profile: LandscapeProfile,
  catalog: ArtCatalog,
): Promise<WorkshopCandidate> {
  const c = naturalCase(id);
  return {
    id: `nature:${id}:${profile}:v1`,
    batchId: "natural-landscapes",
    kind: "geometry",
    name: `${c.name} · ${profile}`,
    prompt:
      id === "motocross"
        ? "Drive the generated city-outskirts motocross park: dirt loop, sky lip, double, curved kicker, tabletop and infield rollers on the shared jump profiles, with race-tuned pit cars. Schematic dirt surfaces; awaiting play review."
        : id === "racetrack"
          ? "Inspect the generated city-outskirts oval, two racing lanes, checkered start line, red/white kerbs and spectator seating. Cars use ordinary collision, driving, roof riding and saved traffic. This composition is awaiting review."
          : "Review woodland, solid forest thickets, pond shores and scenery during travel. Extra dense is the current regional default, using staggered native forest patterns with impassable interiors.",
    url: `/tilefun/workshop.html?geometry=nature-${id}&landscape=${profile}#/tool/world-geometry`,
    exploreUrl: naturalExplorerUrl(c, profile),
    fingerprint: await sha256(
      new TextEncoder().encode(
        JSON.stringify({
          recipe: naturalLandscapeRecipe(id, profile),
          engine: ENGINE_REVIEW_REVISION,
          sources: catalog.sheets.filter(
            (s) =>
              s.id === "prop-oak-tree" ||
              s.id === "me-complete" ||
              s.image.includes("me-autotile") ||
              s.id === "grass-blades",
          ),
        }),
      ),
    ),
  };
}
export async function buildNaturalCandidates(catalog: ArtCatalog) {
  return Promise.all(
    NATURAL_CASES.flatMap((c) =>
      LANDSCAPE_PROFILES.map((p) => buildNaturalCandidate(c.id, p, catalog)),
    ),
  );
}

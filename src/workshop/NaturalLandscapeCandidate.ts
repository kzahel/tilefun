import type { ArtCatalog } from "../art/ArtCatalog.js";
import { sha256 } from "../art/ArtSource.js";
import {
  DEFAULT_LANDSCAPE_PROFILE,
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
  const recipe = naturalLandscapeRecipe(id, profile);
  const hasThickets =
    recipe.generation.type === "regional" &&
    (recipe.landscape ?? DEFAULT_LANDSCAPE_PROFILE) === "thicket";
  return {
    id: `nature:${id}:${profile}:v1`,
    batchId: id === "chicken-pen" ? "farm-chickens" : "natural-landscapes",
    kind: "geometry",
    name: `${c.name} · ${profile}`,
    prompt:
      id === "chicken-pen"
        ? "Compare the rooster's comb and dark tail, the hen, the smaller yellow chick and the egg at game zoom."
        : id === "town-farm"
          ? "Inspect the farm arrival, four garden beds, chicken pen and small woodlot. Check whether the paths and crops are easy to read at game zoom."
          : id === "motocross"
            ? "Drive the generated city-outskirts motocross park: dirt loop, sky lip, double, curved kicker, tabletop and infield rollers on the shared jump profiles, with race-tuned pit cars. Schematic dirt surfaces; awaiting play review."
            : id === "racetrack"
              ? "Inspect the generated city-outskirts oval, two racing lanes, checkered start line, red/white kerbs and spectator seating. Cars use ordinary collision, driving, roof riding and saved traffic. This composition is awaiting review."
              : "Review woodland, solid forest thickets, pond shores and scenery during travel. Extra dense is the current regional default, using staggered native forest patterns with impassable interiors.",
    url: `/tilefun/workshop.html?geometry=nature-${id}&landscape=${profile}#/tool/world-geometry`,
    ...(id !== "chicken-pen" && { exploreUrl: naturalExplorerUrl(c, profile) }),
    fingerprint: await sha256(
      new TextEncoder().encode(
        JSON.stringify({
          recipe,
          engine: ENGINE_REVIEW_REVISION,
          thicketPresentation: hasThickets ? 2 : undefined,
          sources: catalog.sheets.filter(
            (s) =>
              s.id === "prop-oak-tree" ||
              s.id === "me-complete" ||
              s.image.includes("me-autotile") ||
              s.id === "grass-blades" ||
              ((id === "town-farm" || id === "farmstead" || id === "chicken-pen") &&
                s.image.includes("assets/farming/")),
          ),
        }),
      ),
    ),
  };
}
export async function buildNaturalCandidates(catalog: ArtCatalog) {
  return Promise.all(
    NATURAL_CASES.flatMap((c) =>
      (c.id === "chicken-pen" ? [DEFAULT_LANDSCAPE_PROFILE] : LANDSCAPE_PROFILES).map((p) =>
        buildNaturalCandidate(c.id, p, catalog),
      ),
    ),
  );
}

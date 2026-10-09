import type { ArtCatalog } from "../art/ArtCatalog.js";
import { sha256 } from "../art/ArtSource.js";
import propGeometry from "../entities/PropFactories.ts?raw";
import districts from "../generation/regional/DenseDistrictPlanner.ts?raw";
import districtDrawing from "../generation/regional/DenseDistrictStrategy.ts?raw";
import farms from "../generation/regional/FarmsteadPlanner.ts?raw";
import {
  LANDSCAPE_PROFILES,
  type LandscapeProfile,
} from "../generation/regional/NaturalLandscape.js";
import planner from "../generation/regional/NaturalLandscape.ts?raw";
import strategy from "../generation/regional/NaturalStrategy.ts?raw";
import base from "../generation/regional/RegionalPlanner.ts?raw";
import residents from "../generation/regional/ResidentFauna.ts?raw";
import pets from "../generation/regional/SettlementPets.ts?raw";
import forestPatterns from "../patterns/ForestThicket.ts?raw";
import curves from "../railway/CurvedRailPlanner.ts?raw";
import rail from "../railway/RailwayPlanner.ts?raw";
import spriteDrawing from "../rendering/Canvas2DRenderer.ts?raw";
import sceneCollection from "../rendering/collectScene.ts?raw";
import drawing from "../rendering/RasterRenderBackend.ts?raw";
import {
  NATURAL_CASES,
  naturalCase,
  naturalExplorerUrl,
  naturalLandscapeRecipe,
} from "../scenarios/NaturalLandscapeRecipe.js";
import recipes from "../scenarios/NaturalLandscapeRecipe.ts?raw";
import presentation from "../scenarios/ScenarioPresentationHost.ts?raw";
import { scenarioRuntimeSource } from "./ScenarioRuntimeSource.js";
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
      "Review woodland, solid forest thickets, pond shores and scenery during travel. Extra dense is the current regional default, using staggered native forest patterns with impassable interiors.",
    url: `/tilefun/workshop.html?geometry=nature-${id}&landscape=${profile}#/tool/world-geometry`,
    exploreUrl: naturalExplorerUrl(c, profile),
    fingerprint: await sha256(
      new TextEncoder().encode(
        JSON.stringify({
          recipe: naturalLandscapeRecipe(id, profile),
          recipes,
          planner,
          farms,
          pets,
          residents,
          districts,
          districtDrawing,
          strategy,
          base,
          rail,
          curves,
          propGeometry,
          forestPatterns,
          presentation,
          runtime: scenarioRuntimeSource,
          drawing,
          spriteDrawing,
          sceneCollection,
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

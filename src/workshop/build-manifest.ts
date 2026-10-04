import { type ArtCatalog, required } from "../art/ArtCatalog.js";
import { loadVerifiedArtImage } from "../art/ArtSource.js";
import { closeAssets, loadTerrainAssets } from "../assets/GameAssets.js";
import { Spritesheet } from "../assets/Spritesheet.js";
import { BlendGraph } from "../autotile/BlendGraph.js";
import { buildCarProjectionCandidate } from "./CarProjectionCandidate.js";
import { buildCharacterCandidates } from "./CharacterCandidates.js";
import { DOOR_CASES } from "./DoorCandidates.js";
import { buildInteriorCandidates, INTERIOR_BATCHES } from "./InteriorCandidates.js";
import { buildPatternCandidate, TREE_PATTERN_CASES } from "./PatternCandidates.js";
import { buildRailwayCandidates } from "./RailwayCandidates.js";
import { artReviewDefinitions, buildArtCandidate } from "./ReviewCandidates.js";
import { CITY_BATCHES, WORKSHOP_TOOLS } from "./ToolRegistry.js";
import { buildVehicleCandidates } from "./VehicleCandidates.js";
import type { WorkshopCandidate } from "./WorkshopTypes.js";
import { buildWorldGeometryCandidate } from "./WorldGeometryCandidate.js";

const catalog = (await fetch("/tilefun/data/art-catalog.json").then((r) => r.json())) as ArtCatalog;
const source = required(catalog.sheets.find((s) => s.id === "me-complete"));
const assets = await loadTerrainAssets(new BlendGraph());
assets.sheets.set(
  "me-complete",
  new Spritesheet(await createImageBitmap(await loadVerifiedArtImage(source)), 16, 16),
);
try {
  const canvas = document.createElement("canvas"),
    candidates: WorkshopCandidate[] = [];
  for (const definition of artReviewDefinitions())
    candidates.push(await buildArtCandidate(canvas, definition, assets, catalog));
  for (const c of TREE_PATTERN_CASES)
    candidates.push(await buildPatternCandidate(canvas, c.id, assets, catalog));
  for (const id of DOOR_CASES)
    candidates.push(await buildPatternCandidate(canvas, id, assets, catalog));
  candidates.push(await buildCarProjectionCandidate());
  candidates.push(await buildWorldGeometryCandidate(), await buildWorldGeometryCandidate(true));
  candidates.push(...(await buildRailwayCandidates()));
  candidates.push(...(await buildInteriorCandidates()));
  candidates.push(...(await buildCharacterCandidates(catalog)));
  candidates.push(...(await buildVehicleCandidates(await loadVerifiedArtImage(source))));
  Object.assign(window, {
    workshopManifest: {
      version: 1,
      tools: WORKSHOP_TOOLS,
      batches: [
        ...CITY_BATCHES,
        {
          id: "doorways-v1",
          name: "Door opening animations",
          description: "Exact facade overlays; walk-through travel in game.",
          toolId: "buildings",
        },
        ...INTERIOR_BATCHES,
        {
          id: "motion",
          name: "Furniture movement sets",
          description:
            "Default layouts and physics. Custom layouts remain individually reviewable in the tool.",
          toolId: "motion",
        },
      ],
      candidates,
    },
    workshopManifestReady: true,
  });
} finally {
  closeAssets(assets);
}

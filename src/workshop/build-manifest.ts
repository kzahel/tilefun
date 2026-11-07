import type { ArtCatalog } from "../art/ArtCatalog.js";
import { loadVerifiedArtImage } from "../art/ArtSource.js";
import { PARKING_CASES } from "../art/studies/ParkingLotStudy.js";
import { closeAssets, loadTerrainAssets } from "../assets/GameAssets.js";
import { Spritesheet } from "../assets/Spritesheet.js";
import { BlendGraph } from "../autotile/BlendGraph.js";
import { required } from "../shared/required.js";
import { buildAuthoredTrainCandidate } from "./AuthoredTrainCandidate.js";
import {
  buildAuthoredVehicleCandidates,
  buildCarProjectionCandidate,
} from "./CarProjectionCandidate.js";
import { buildCharacterCandidates } from "./CharacterCandidates.js";
import { DOOR_CASES } from "./DoorCandidates.js";
import { buildFamilySheetCandidates } from "./FamilySheetCandidates.js";
import { buildInteriorCandidates, INTERIOR_BATCHES } from "./InteriorCandidates.js";
import { buildNaturalCandidates } from "./NaturalLandscapeCandidate.js";
import { buildOriginalVehicleCandidates } from "./OriginalVehicleCandidates.js";
import { buildParkingVisitCandidate } from "./ParkingVisitCandidate.js";
import { buildPatternCandidate, TREE_PATTERN_CASES } from "./PatternCandidates.js";
import { buildPhysicsCandidate } from "./PhysicsCandidate.js";
import { buildRacetrackCandidate } from "./RacetrackCandidate.js";
import { buildRailwayCandidates } from "./RailwayCandidates.js";
import { artReviewDefinitions, buildArtCandidate } from "./ReviewCandidates.js";
import { CITY_BATCHES, WORKSHOP_TOOLS, workshopToolMetadata } from "./ToolRegistry.js";
import { buildTowingCandidate } from "./TowingCandidate.js";
import { buildTransporterCandidate } from "./TransporterCandidate.js";
import { buildTruckBedCandidate } from "./TruckBedCandidate.js";
import { buildVehicleBakeCandidates } from "./VehicleBakeCandidates.js";
import { buildVehicleCandidates } from "./VehicleCandidates.js";
import { buildVehicleGameFitCandidate } from "./VehicleGameFitCandidate.js";
import { buildVehicleStyleStudyCandidates } from "./VehicleStyleStudyCandidates.js";
import { buildWildlifeCandidates, WILDLIFE_BATCHES } from "./WildlifeCandidates.js";
import type { WorkshopCandidate } from "./WorkshopTypes.js";
import {
  buildCityTrainCandidate,
  buildCurvedTrainCandidate,
  buildGeneratedCrossingCandidate,
  buildWorldGeometryCandidate,
} from "./WorldGeometryCandidate.js";

type Built = WorkshopCandidate | readonly WorkshopCandidate[];
/** One manifest builder call; a step starts only after the previous step has resolved. */
type CandidateStep = () => Built | Promise<Built>;

/** Builds one candidate per item, strictly one after another. */
async function inSequence<T>(
  items: Iterable<T>,
  build: (item: T) => Promise<WorkshopCandidate>,
): Promise<WorkshopCandidate[]> {
  const built: WorkshopCandidate[] = [];
  for (const item of items) built.push(await build(item));
  return built;
}

const catalog = (await fetch("/tilefun/data/art-catalog.json").then((r) => r.json())) as ArtCatalog;
const source = required(catalog.sheets.find((s) => s.id === "me-complete"));
const assets = await loadTerrainAssets(new BlendGraph());
assets.sheets.set(
  "me-complete",
  new Spritesheet(await createImageBitmap(await loadVerifiedArtImage(source)), 16, 16),
);
try {
  const canvas = document.createElement("canvas");
  // Manifest candidate order is exactly this step order. Add a new tool's builder as one step,
  // at the end unless an earlier position is intended.
  const steps: readonly CandidateStep[] = [
    () =>
      inSequence(artReviewDefinitions(), (definition) =>
        buildArtCandidate(canvas, definition, assets, catalog),
      ),
    () =>
      inSequence(TREE_PATTERN_CASES, (c) => buildPatternCandidate(canvas, c.id, assets, catalog)),
    () =>
      inSequence(PARKING_CASES, (c) =>
        buildPatternCandidate(canvas, `parking-v1-${c.id}`, assets, catalog),
      ),
    () => inSequence(DOOR_CASES, (id) => buildPatternCandidate(canvas, id, assets, catalog)),
    () => buildParkingVisitCandidate(),
    () => buildPhysicsCandidate(),
    () => buildParkingVisitCandidate(true),
    () => buildNaturalCandidates(catalog),
    () => buildCarProjectionCandidate(),
    () => buildAuthoredVehicleCandidates(),
    () => buildVehicleStyleStudyCandidates(),
    () => buildVehicleBakeCandidates(),
    () => buildOriginalVehicleCandidates(),
    () => buildVehicleGameFitCandidate("v1"),
    () => buildVehicleGameFitCandidate("v2"),
    () => buildAuthoredTrainCandidate("v1"),
    () => buildAuthoredTrainCandidate("v3"),
    () => buildWorldGeometryCandidate(),
    () => buildWorldGeometryCandidate("garage"),
    () => buildWorldGeometryCandidate("crossing"),
    () => buildWorldGeometryCandidate("car-bridge"),
    () => buildWorldGeometryCandidate("car-garage"),
    () => buildWorldGeometryCandidate("car-dynamics"),
    () => buildWorldGeometryCandidate("car-jumps"),
    () => buildWorldGeometryCandidate("tree-house"),
    () => buildWorldGeometryCandidate("outskirts-park"),
    () => buildWorldGeometryCandidate("traffic"),
    () => buildWorldGeometryCandidate("train-grades"),
    () => buildTruckBedCandidate(),
    () => buildTowingCandidate(),
    () => buildTransporterCandidate(),
    () => buildRacetrackCandidate(),
    () => buildCurvedTrainCandidate(true),
    () => buildCurvedTrainCandidate(false),
    () => buildCityTrainCandidate(),
    // The three generated crossings render concurrently, as they always have.
    () => Promise.all([0, 1, 2].map(buildGeneratedCrossingCandidate)),
    () => buildRailwayCandidates(),
    () => buildFamilySheetCandidates(),
    () => buildInteriorCandidates(),
    () => buildCharacterCandidates(catalog),
    () => buildWildlifeCandidates(),
    async () => buildVehicleCandidates(await loadVerifiedArtImage(source)),
  ];
  const candidates: WorkshopCandidate[] = [];
  for (const step of steps) candidates.push(...[await step()].flat());
  Object.assign(window, {
    workshopManifest: {
      version: 1,
      tools: WORKSHOP_TOOLS.map(workshopToolMetadata),
      batches: [
        ...CITY_BATCHES,
        {
          id: "natural-landscapes",
          name: "Natural landscapes",
          description:
            "Nine seeded scenes, including three solid forest kits and a train journey. Compare sparse, balanced, lush and extra-dense landscapes.",
          toolId: "world-geometry",
        },
        {
          id: "asset-families",
          name: "Asset families",
          description:
            "Cabinets, trees and scrapyard pieces. Browse the proposed descriptions and leave shared notes.",
          toolId: "families",
        },
        {
          id: "doorways-v1",
          name: "Door opening animations",
          description: "Exact facade overlays; walk-through travel in game.",
          toolId: "buildings",
        },
        ...INTERIOR_BATCHES,
        ...WILDLIFE_BATCHES,
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

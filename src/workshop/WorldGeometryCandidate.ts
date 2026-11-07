import { sha256 } from "../art/ArtSource.js";
import {
  GENERATED_CROSSINGS,
  generatedCrossingRecipe,
} from "../scenarios/GeneratedCrossingRecipe.js";
import { jumpParkRecipe } from "../scenarios/JumpParkRecipe.js";
import { railCrossingRecipe } from "../scenarios/RailCrossingRecipe.js";
import { roadTrafficRecipe } from "../scenarios/RoadTrafficRecipe.js";
import { treeHouseRecipe } from "../scenarios/TreeHouseRecipe.js";
import { undergroundGarageRecipe } from "../scenarios/UndergroundGarageRecipe.js";
import { vehicleDynamicsRecipe } from "../scenarios/VehicleDynamicsRecipe.js";
import { vehicleGeometryRecipe } from "../scenarios/VehicleGeometryRecipe.js";
import { worldGeometryRecipe } from "../scenarios/WorldGeometryRecipe.js";
import { required } from "../shared/required.js";
import { deferredVehicleCandidate } from "./DeferredVehicleCandidate.js";
import { ENGINE_REVIEW_REVISION } from "./EngineReviewRevision.js";
import type { WorkshopCandidate } from "./WorkshopTypes.js";

const INSPECT_PROMPT =
  "Inspect traversal, support, headroom, underpass and save/reload against the ordinary shared game kernel. Cars are independently controlled freely rotating chassis with suspension. Schematic geometry; no art promotion.";
const driving = (fixture: string) => `Basic driving · ${fixture}`;
const GEOMETRY_FIXTURES = {
  deck: {
    id: "geometry:deck-ramp-v1",
    name: "Ramp, deck and lower passage",
    recipe: () => worldGeometryRecipe(),
  },
  garage: {
    id: "geometry:underground-garage-v1",
    name: "Underground garage and street",
    recipe: () => undergroundGarageRecipe(),
  },
  crossing: {
    id: "geometry:rail-crossing-v1",
    name: "Road bridge and level underpass",
    recipe: () => railCrossingRecipe(),
  },
  "car-bridge": {
    id: "geometry:car-bridge-v1",
    name: driving("car-bridge"),
    recipe: () => vehicleGeometryRecipe(false),
  },
  "car-garage": {
    id: "geometry:car-garage-v1",
    name: driving("car-garage"),
    recipe: () => vehicleGeometryRecipe(true),
  },
  "car-dynamics": {
    id: "geometry:car-dynamics-v1",
    name: driving("car-dynamics"),
    recipe: () => vehicleDynamicsRecipe(),
  },
  "car-jumps": {
    id: "geometry:car-jumps-v1",
    name: "Jump park: curved kicker, sky lip, double, tabletop and rollers",
    recipe: () => jumpParkRecipe(),
    prompt:
      "Drive each jump lane at full boost in race-tuned and ordinary cars: judge air height, lip shape, landings and boost speed. Ordinary shared physics; schematic geometry, no art promotion.",
  },
  "tree-house": {
    id: "geometry:tree-house-v1",
    name: "Tree house: ladder climbing and an enterable cabin",
    recipe: () => treeHouseRecipe(),
    prompt:
      "Climb the ladder, hang on, step onto the porch and walk into the cabin; judge climbing speed, the roof cutaway and getting back down. Shared physics; unedited Modern Exteriors crops placed for a lab experiment, not promoted art.",
  },
  traffic: {
    id: "geometry:road-traffic-v1",
    name: "Rolling driving and ordinary road traffic",
    recipe: () => roadTrafficRecipe(),
  },
} satisfies Record<string, { id: string; name: string; recipe: () => unknown; prompt?: string }>;

export async function buildWorldGeometryCandidate(
  fixture: keyof typeof GEOMETRY_FIXTURES | "train-grades" = "deck",
): Promise<WorkshopCandidate> {
  const url = `/tilefun/workshop.html?geometry=${fixture}#/tool/world-geometry`;
  if (fixture === "train-grades")
    return deferredVehicleCandidate("geometry:train-grades-v1", "Train grades (deferred)", url);
  const entry: { id: string; name: string; recipe: () => unknown; prompt?: string } =
    GEOMETRY_FIXTURES[fixture];
  return {
    id: entry.id,
    batchId: "world-geometry",
    kind: "geometry",
    name: entry.name,
    prompt: entry.prompt ?? INSPECT_PROMPT,
    url,
    fingerprint: await fingerprint(entry.recipe()),
    excluded: "Interactive engine experiment; not an immutable art approval snapshot.",
  };
}
async function fingerprint(recipe: unknown) {
  return sha256(
    new TextEncoder().encode(
      JSON.stringify({
        recipe,
        engine: ENGINE_REVIEW_REVISION,
      }),
    ),
  );
}
export async function buildGeneratedCrossingCandidate(index: number): Promise<WorkshopCandidate> {
  const scene = generatedCrossingRecipe(index),
    { key, label } = required(GENERATED_CROSSINGS[index]);
  return {
    id: `geometry:generated-crossing-${key}-v1`,
    batchId: "world-geometry",
    kind: "geometry",
    name: `Generated road bridge · ${label}`,
    prompt:
      "Walk both generated approaches and underneath, or drive the staged car. Static regional geometry and normal shared physics.",
    url: `/tilefun/workshop.html?geometry=generated-${key}#/tool/world-geometry`,
    fingerprint: await fingerprint(scene),
    excluded: "Interactive generated-world experiment; no immutable art promotion.",
  };
}
export function buildCurvedTrainCandidate(loop: boolean) {
  const fixture = loop ? "train-loop" : "train-winding";
  return deferredVehicleCandidate(
    `geometry:${fixture}-v1`,
    "Curved train service (deferred)",
    `/tilefun/workshop.html?geometry=${fixture}#/tool/world-geometry`,
  );
}
export function buildCityTrainCandidate() {
  return deferredVehicleCandidate(
    "geometry:city-trains-v1",
    "City train service (deferred)",
    "/tilefun/workshop.html?geometry=city-trains#/tool/world-geometry",
  );
}

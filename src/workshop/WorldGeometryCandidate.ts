import { sha256 } from "../art/ArtSource.js";
import { generatedCrossingRecipe } from "../scenarios/GeneratedCrossingRecipe.js";
import { jumpParkRecipe } from "../scenarios/JumpParkRecipe.js";
import { railCrossingRecipe } from "../scenarios/RailCrossingRecipe.js";
import { roadTrafficRecipe } from "../scenarios/RoadTrafficRecipe.js";
import { undergroundGarageRecipe } from "../scenarios/UndergroundGarageRecipe.js";
import { vehicleDynamicsRecipe } from "../scenarios/VehicleDynamicsRecipe.js";
import { vehicleGeometryRecipe } from "../scenarios/VehicleGeometryRecipe.js";
import { worldGeometryRecipe } from "../scenarios/WorldGeometryRecipe.js";
import { deferredVehicleCandidate } from "./DeferredVehicleCandidate.js";
import { ENGINE_REVIEW_REVISION } from "./EngineReviewRevision.js";
import type { WorkshopCandidate } from "./WorkshopTypes.js";
export async function buildWorldGeometryCandidate(
  fixture:
    | "deck"
    | "garage"
    | "crossing"
    | "car-bridge"
    | "car-garage"
    | "car-dynamics"
    | "car-jumps"
    | "train-grades"
    | "traffic" = "deck",
): Promise<WorkshopCandidate> {
  const url = `/tilefun/workshop.html?geometry=${fixture}#/tool/world-geometry`;
  if (fixture === "train-grades")
    return deferredVehicleCandidate("geometry:train-grades-v1", "Train grades (deferred)", url);
  const garage = fixture === "garage" || fixture === "car-garage",
    vehicle = fixture.startsWith("car-");
  const recipe =
    fixture === "car-dynamics"
      ? vehicleDynamicsRecipe()
      : fixture === "car-jumps"
        ? jumpParkRecipe()
        : fixture === "traffic"
          ? roadTrafficRecipe()
          : vehicle
            ? vehicleGeometryRecipe(garage)
            : fixture === "crossing"
              ? railCrossingRecipe()
              : garage
                ? undergroundGarageRecipe()
                : worldGeometryRecipe();
  const id =
    fixture === "traffic"
      ? "geometry:road-traffic-v1"
      : vehicle
        ? `geometry:${fixture}-v1`
        : fixture === "crossing"
          ? "geometry:rail-crossing-v1"
          : garage
            ? "geometry:underground-garage-v1"
            : "geometry:deck-ramp-v1";
  return {
    id,
    batchId: "world-geometry",
    kind: "geometry",
    name:
      fixture === "traffic"
        ? "Rolling driving and ordinary road traffic"
        : fixture === "car-jumps"
          ? "Jump park: curved kicker, sky lip, double, tabletop and rollers"
          : vehicle
            ? `Basic driving · ${fixture}`
            : fixture === "crossing"
              ? "Road bridge and level underpass"
              : garage
                ? "Underground garage and street"
                : "Ramp, deck and lower passage",
    prompt:
      fixture === "car-jumps"
        ? "Drive each jump lane at full boost in race-tuned and ordinary cars: judge air height, lip shape, landings and boost speed. Ordinary shared physics; schematic geometry, no art promotion."
        : "Inspect traversal, support, headroom, underpass and save/reload against the ordinary shared game kernel. Cars are independently controlled freely rotating chassis with suspension. Schematic geometry; no art promotion.",
    url,
    fingerprint: await fingerprint(recipe),
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
    seed = scene.recipe.generation.seed;
  return {
    id: `geometry:generated-crossing-${seed}-v1`,
    batchId: "world-geometry",
    kind: "geometry",
    name: `Generated road bridge · seed ${seed}`,
    prompt:
      "Walk both generated approaches and underneath, or drive the staged car. Static regional geometry and normal shared physics; train services are deferred.",
    url: `/tilefun/workshop.html?geometry=generated-${seed}#/tool/world-geometry`,
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

import { sha256 } from "../art/ArtSource.js";
import collision from "../entities/collision.ts?raw";
import movement from "../physics/PlayerMovement.ts?raw";
import queries from "../physics/SimulationEnvironment.ts?raw";
import geometry from "../physics/SurfacePatch.ts?raw";
import support from "../physics/surfaceHeight.ts?raw";
import excavation from "../physics/TerrainExcavation.ts?raw";
import railway from "../railway/RailwaySystem.ts?raw";
import trainBodies from "../railway/Train.ts?raw";
import ordering from "../rendering/presentSurfaceScene.ts?raw";
import presentation from "../rendering/SurfacePresentation.ts?raw";
import { railCrossingRecipe } from "../scenarios/RailCrossingRecipe.js";
import { trainGeometryRecipe } from "../scenarios/TrainGeometryRecipe.js";
import { undergroundGarageRecipe } from "../scenarios/UndergroundGarageRecipe.js";
import { vehicleGeometryRecipe } from "../scenarios/VehicleGeometryRecipe.js";
import { worldGeometryRecipe } from "../scenarios/WorldGeometryRecipe.js";
import traffic from "../traffic/TrafficSystem.ts?raw";
import type { WorkshopCandidate } from "./WorkshopTypes.js";

export async function buildWorldGeometryCandidate(
  fixture: "deck" | "garage" | "crossing" | "car-bridge" | "car-garage" | "train-grades" = "deck",
): Promise<WorkshopCandidate> {
  const garage = fixture === "garage" || fixture === "car-garage",
    crossing = fixture === "crossing" || fixture === "car-bridge",
    vehicle = fixture.startsWith("car-"),
    trainGrade = fixture === "train-grades";
  const fingerprint = await sha256(
    new TextEncoder().encode(
      JSON.stringify({
        ...(vehicle ? { traffic, reverseRecipe: vehicleGeometryRecipe(garage, true) } : {}),
        ...(trainGrade ? { railway, trainBodies, reverseRecipe: trainGeometryRecipe(true) } : {}),
        recipe: trainGrade
          ? trainGeometryRecipe()
          : vehicle
            ? vehicleGeometryRecipe(garage)
            : crossing
              ? railCrossingRecipe()
              : garage
                ? undergroundGarageRecipe()
                : worldGeometryRecipe(),
        ...(garage || trainGrade ? { excavation } : {}),
        collision,
        movement,
        queries,
        support,
        geometry,
        presentation,
        ordering,
        ...(crossing ? { railway } : {}),
      }),
    ),
  );
  return {
    id: trainGrade
      ? "geometry:train-grades-v1"
      : vehicle
        ? `geometry:${fixture}-v1`
        : crossing
          ? "geometry:rail-crossing-v1"
          : garage
            ? "geometry:underground-garage-v1"
            : "geometry:deck-ramp-v1",
    batchId: "world-geometry",
    kind: "geometry",
    name: trainGrade
      ? "Train grades, bridge and tunnel"
      : vehicle
        ? garage
          ? "Car entering an underground garage"
          : "Car crossing the railway bridge"
        : crossing
          ? "Road bridge over a moving train"
          : garage
            ? "Underground garage, entrance and usable street"
            : "Ramp, raised deck and lower passage",
    prompt: trainGrade
      ? "Follow three independent carriage heights across ramps, bridge and tunnel, reverse at both termini and reload on a slope. Schematic proof with horizontal native art and visible slope-join limitations."
      : vehicle
        ? "Run both directions and reload on the ramp; inspect full-body support and clearance using production traffic. Level chassis, schematic surfaces, unchanged native car art."
        : crossing
          ? "Walk both road approaches while the production train service passes beneath; inspect clearance, ordering and save/reload. Schematic engine proof."
          : garage
            ? "Walk down through an opening in terrain into a covered garage, return continuously, and compare street/garage space identity and reload."
            : "Walk above and below the deck, jump into its underside and switch cutaway visibility. Schematic engine proof; no art promotion.",
    url: trainGrade
      ? "/tilefun/workshop.html?geometry=train-grades#/tool/world-geometry"
      : vehicle
        ? `/tilefun/workshop.html?geometry=${fixture}#/tool/world-geometry`
        : crossing
          ? "/tilefun/workshop.html?geometry=crossing#/tool/world-geometry"
          : garage
            ? "/tilefun/workshop.html?geometry=garage#/tool/world-geometry"
            : "/tilefun/workshop.html#/tool/world-geometry",
    fingerprint,
    excluded: "Interactive engine experiment; not an immutable art approval snapshot.",
  };
}

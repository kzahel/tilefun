import { sha256 } from "../art/ArtSource.js";
import prediction from "../client/PlayerPredictor.ts?raw";
import balls from "../physics/BallPhysics.ts?raw";
import collision from "../physics/SimulationEnvironment.ts?raw";
import surfaces from "../physics/surfaceHeight.ts?raw";
import {
  authoredVehicleForType,
  vehicleMeshHeightScale,
} from "../rendering/AuthoredVehicleMeshes.js";
import assetLoader from "../rendering/CarMeshAsset.ts?raw";
import outline from "../rendering/CarPixelOutline.ts?raw";
import collection from "../rendering/collectScene.ts?raw";
import meshBodies from "../rendering/GpuMeshBodies.ts?raw";
import contents from "../rendering/GpuVehicleContents.ts?raw";
import debug from "../rendering/VehicleBedDebug.ts?raw";
import fallback from "../rendering/VehicleBedPresentation.ts?raw";
import recipe from "../scenarios/TruckBedRecipe.ts?raw";
import cargoControl from "../server/VehicleBedControl.ts?raw";
import codec from "../shared/binaryCodec.ts?raw";
import deltas from "../shared/entityDelta.ts?raw";
import serialization from "../shared/serialization.ts?raw";
import driving from "../traffic/Driving.ts?raw";
import support from "../traffic/MovingSupport.ts?raw";
import roofSupport from "../traffic/RoofSupport.ts?raw";
import traffic from "../traffic/TrafficSystem.ts?raw";
import vehicles from "../traffic/Vehicle.ts?raw";
import geometry from "../traffic/VehicleBed.ts?raw";
import cargo from "../traffic/VehicleCargo.ts?raw";
import pushes from "../traffic/VehiclePush.ts?raw";
import vehicleControls from "../ui/VehicleControl.ts?raw";
import { scenarioRuntimeSource } from "./ScenarioRuntimeSource.js";
import page from "./TruckBedPage.tsx?raw";
import type { WorkshopCandidate } from "./WorkshopTypes.js";

export async function buildTruckBedCandidate(): Promise<WorkshopCandidate> {
  return {
    id: "geometry:truck-bed-v1",
    batchId: "world-geometry",
    kind: "geometry",
    name: "Playable dump-truck bed",
    prompt:
      "Use ordinary game controls to board, carry loose toys/food, ride and reload. Inspect floor/wall contacts and upright sprite depth. Level bed; tipping requires an articulated revision.",
    url: "/tilefun/workshop.html?geometry=truck-bed#/tool/world-geometry",
    fingerprint: await sha256(
      new TextEncoder().encode(
        JSON.stringify({
          prediction,
          collision,
          surfaces,
          codec,
          serialization,
          deltas,
          roofSupport,
          assetLoader,
          outline,
          geometry,
          traffic,
          driving,
          pushes,
          vehicles,
          cargo,
          cargoControl,
          vehicleControls,
          balls,
          support,
          collection,
          contents,
          meshBodies,
          fallback,
          debug,
          recipe,
          page,
          runtime: scenarioRuntimeSource,
          registration: authoredVehicleForType("vehicle-v1:dump-truck"),
          heightScale: vehicleMeshHeightScale("dump-truck"),
          model: "eda05b91da120bf76cbb6df9e0e9480cca2706d6d72cc42734a9e3e224201bd3",
        }),
      ),
    ),
    excluded:
      "Interactive engine prototype using unchanged approved artwork; not an immutable art approval snapshot.",
  };
}

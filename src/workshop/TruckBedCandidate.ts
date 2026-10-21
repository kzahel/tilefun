import { sha256 } from "../art/ArtSource.js";
import prediction from "../client/PlayerPredictor.ts?raw";
import remotePresentation from "../client/RemotePresentation.ts?raw";
import collisionIndex from "../entities/CollisionIndex.ts?raw";
import spatialHash from "../entities/SpatialHash.ts?raw";
import controllerBindings from "../input/ControllerBindings.ts?raw";
import balls from "../physics/BallPhysics.ts?raw";
import collision from "../physics/SimulationEnvironment.ts?raw";
import surfaces from "../physics/surfaceHeight.ts?raw";
import foodPhysics from "../physics/VehicleCargoPhysics.ts?raw";
import {
  authoredVehicleForType,
  vehicleMeshHeightScale,
} from "../rendering/AuthoredVehicleMeshes.js";
import assetLoader from "../rendering/CarMeshAsset.ts?raw";
import outline from "../rendering/CarPixelOutline.ts?raw";
import collection from "../rendering/collectScene.ts?raw";
import cpuFallback from "../rendering/DumpTruckFallback.ts?raw";
import cpuGeometry from "../rendering/dump-truck-v2-fallback.json?raw";
import meshBodies from "../rendering/GpuMeshBodies.ts?raw";
import contents from "../rendering/GpuVehicleContents.ts?raw";
import timeline from "../rendering/PresentationTimeline.ts?raw";
import debug from "../rendering/VehicleBedDebug.ts?raw";
import fallback from "../rendering/VehicleBedPresentation.ts?raw";
import recipe from "../scenarios/TruckBedRecipe.ts?raw";
import cargoControl from "../server/VehicleBedControl.ts?raw";
import codec from "../shared/binaryCodec.ts?raw";
import deltas from "../shared/entityDelta.ts?raw";
import serialization from "../shared/serialization.ts?raw";
import solids from "../traffic/BedSolid.ts?raw";
import driving from "../traffic/Driving.ts?raw";
import support from "../traffic/MovingSupport.ts?raw";
import roofSupport from "../traffic/RoofSupport.ts?raw";
import traffic from "../traffic/TrafficSystem.ts?raw";
import vehicles from "../traffic/Vehicle.ts?raw";
import geometry from "../traffic/VehicleBed.ts?raw";
import equipment from "../traffic/VehicleBedEquipment.ts?raw";
import slide from "../traffic/VehicleBedSlide.ts?raw";
import cargo from "../traffic/VehicleCargo.ts?raw";
import pushes from "../traffic/VehiclePush.ts?raw";
import contextActions from "../ui/ContextActions.ts?raw";
import vehicleControls from "../ui/VehicleControl.ts?raw";
import { scenarioRuntimeSource } from "./ScenarioRuntimeSource.js";
import page from "./TruckBedPage.tsx?raw";
import type { WorkshopCandidate } from "./WorkshopTypes.js";

export async function buildTruckBedCandidate(): Promise<WorkshopCandidate> {
  return {
    id: "geometry:truck-bed-v2",
    batchId: "world-geometry",
    kind: "geometry",
    name: "Tipping dump-truck bed",
    prompt:
      "Use ordinary game controls to board, carry loose toys/food, ride and reload. Inspect floor/wall contacts and upright sprite depth. Tip/lower the articulated bed and inspect real cargo/rider discharge.",
    url: "/tilefun/workshop.html?geometry=truck-bed#/tool/world-geometry",
    fingerprint: await sha256(
      new TextEncoder().encode(
        JSON.stringify({
          contextActions,
          controllerBindings,
          solids,
          spatialHash,
          collisionIndex,
          equipment,
          slide,
          foodPhysics,
          cpuFallback,
          cpuGeometry,
          remotePresentation,
          timeline,
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
          model: "237be10a2c5e63b9e7b226d4d6e4acd84f623e703386a2b43b43f3e0baecc719",
        }),
      ),
    ),
    excluded:
      "Interactive articulated-equipment engine review; v1 source preserved, changed v2 poses await human inspection. Not an immutable art approval snapshot.",
  };
}

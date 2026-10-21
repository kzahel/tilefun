import fallbackRecipe from "../../art-source/vehicle-bake/towing-fallbacks/v2/recipe.json?raw";
import { sha256 } from "../art/ArtSource.js";
import prediction from "../client/PlayerPredictor.ts?raw";
import controllerBindings from "../input/ControllerBindings.ts?raw";
import loader from "../rendering/CarMeshAsset.ts?raw";
import collection from "../rendering/collectScene.ts?raw";
import meshBodies from "../rendering/GpuMeshBodies.ts?raw";
import fallback from "../rendering/TowingFallback.ts?raw";
import fallbackFrames from "../rendering/towing-fallbacks.json?raw";
import recipe from "../scenarios/TowingRecipe.ts?raw";
import control from "../server/TowControl.ts?raw";
import driving from "../traffic/Driving.ts?raw";
import towing from "../traffic/Towing.ts?raw";
import traffic from "../traffic/TrafficSystem.ts?raw";
import profiles from "../traffic/towing-profiles.json?raw";
import contextActions from "../ui/ContextActions.ts?raw";
import ui from "../ui/VehicleControl.ts?raw";
import { scenarioRuntimeSource } from "./ScenarioRuntimeSource.js";
import page from "./TowingPage.tsx?raw";
import type { WorkshopCandidate } from "./WorkshopTypes.js";

export async function buildTowingCandidate(): Promise<WorkshopCandidate> {
  return {
    id: "geometry:wheel-lift-towing-v1",
    batchId: "world-geometry",
    kind: "geometry",
    name: "Wheel-lift tow truck",
    prompt:
      "Attach a parked car using normal controls; drive, reverse, save/reload and release. Inspect the raised front axle and rolling rear wheels.",
    url: "/tilefun/workshop.html?geometry=towing#/tool/world-geometry",
    fingerprint: await sha256(
      new TextEncoder().encode(
        JSON.stringify({
          contextActions,
          controllerBindings,
          towing,
          profiles,
          traffic,
          driving,
          control,
          ui,
          page,
          recipe,
          loader,
          meshBodies,
          collection,
          fallback,
          fallbackRecipe,
          fallbackFrames,
          prediction,
          runtime: scenarioRuntimeSource,
          model: "cf77b72b33eb76c7303f88641d5682e379485359dcaac0f113672069a32ae180",
        }),
      ),
    ),
    excluded:
      "Interactive shared-engine towing qualification; new equipment poses await human inspection. Not an immutable art approval snapshot.",
  };
}

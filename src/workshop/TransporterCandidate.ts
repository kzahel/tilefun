import capture from "../../art-source/vehicle-bake/car-transporter/v2/capture-recipe.json";
import { sha256 } from "../art/ArtSource.js";
import loader from "../rendering/CarMeshAsset.ts?raw";
import collection from "../rendering/collectScene.ts?raw";
import meshBodies from "../rendering/GpuMeshBodies.ts?raw";
import fallback from "../rendering/TransporterFallback.ts?raw";
import recipe from "../scenarios/TransporterRecipe.ts?raw";
import control from "../server/TransporterControl.ts?raw";
import geometry from "../traffic/CarTransporter.ts?raw";
import driving from "../traffic/Driving.ts?raw";
import traffic from "../traffic/TrafficSystem.ts?raw";
import surface from "../traffic/TransporterSurface.ts?raw";
import actions from "../ui/ContextActions.ts?raw";
import ui from "../ui/VehicleControl.ts?raw";
import { scenarioRuntimeSource } from "./ScenarioRuntimeSource.js";
import page from "./TransporterPage.tsx?raw";
import type { WorkshopCandidate } from "./WorkshopTypes.js";

export async function buildTransporterCandidate(): Promise<WorkshopCandidate> {
  return {
    id: "geometry:car-transporter-v2",
    batchId: "world-geometry",
    kind: "geometry",
    name: "Single-car transporter",
    prompt:
      "Deploy the ramp, drive a car aboard, get out and secure it. Stow, drive, reload, then deploy/release and reverse off. Inspect axle support and shared depth.",
    url: "/tilefun/workshop.html?geometry=transporter#/tool/world-geometry",
    fingerprint: await sha256(
      new TextEncoder().encode(
        JSON.stringify({
          capture,
          loader,
          collection,
          meshBodies,
          fallback,
          recipe,
          control,
          geometry,
          surface,
          driving,
          traffic,
          actions,
          ui,
          page,
          runtime: scenarioRuntimeSource,
        }),
      ),
    ),
    excluded:
      "Interactive shared-engine machinery qualification; new original appearance awaits human inspection. This is not a promoted art approval snapshot.",
  };
}

import { sha256 } from "../art/ArtSource.js";
import {
  VEHICLE_SOURCE,
  VEHICLE_VIEWS,
  type VehicleView,
} from "../assets/vehicles/VehicleCatalog.js";
import { drawVehicleDiagram } from "../assets/vehicles/VehicleDiagram.js";
import type { WorkshopCandidate } from "./WorkshopTypes.js";

export async function buildVehicleCandidate(
  canvas: HTMLCanvasElement,
  image: CanvasImageSource,
  view: VehicleView,
): Promise<WorkshopCandidate> {
  drawVehicleDiagram(canvas, image, view.asset, view.asset.metadata);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  const render = await sha256(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
  const fingerprint = await sha256(
    new TextEncoder().encode(JSON.stringify({ source: VEHICLE_SOURCE.sha256, view, render })),
  );
  return {
    id: view.id,
    batchId: "vehicles",
    name: `${view.name} · ${view.direction}`,
    prompt: view.guidance,
    url: `/tilefun/workshop.html#/tool/vehicles?view=${encodeURIComponent(view.id)}`,
    kind: "vehicle",
    fingerprint,
    sourceFingerprint: VEHICLE_SOURCE.sha256,
    vehicle: view,
  };
}
export async function buildVehicleCandidates(image: CanvasImageSource) {
  const canvas = document.createElement("canvas");
  const results: WorkshopCandidate[] = [];
  for (const view of VEHICLE_VIEWS) results.push(await buildVehicleCandidate(canvas, image, view));
  return results;
}

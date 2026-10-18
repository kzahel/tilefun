import type { Spritesheet } from "../../assets/Spritesheet.js";
import { VEHICLE_VIEWS } from "../../assets/vehicles/VehicleCatalog.js";
import { drawCitySurfacePieces } from "../../rendering/CitySurfaceRenderer.js";
import type { SurfacePiece } from "../../road/CitySurfaceRecipes.js";
import { required } from "../ArtCatalog.js";
import { reviewContext2D } from "../reviewCanvas.js";

export type {
  ParkingBay,
  ParkingCaseId,
  ParkingRect,
  ParkingStudy,
} from "../../traffic/ParkingLayout.js";
export { PARKING_CASES, PARKING_KIT, parkingStudy } from "../../traffic/ParkingLayout.js";

import {
  PARKING_CASES,
  type ParkingBay,
  type ParkingCaseId,
  parkingStudy,
} from "../../traffic/ParkingLayout.js";

export function drawParkingStudy(
  canvas: HTMLCanvasElement,
  id: ParkingCaseId,
  sheet: Spritesheet,
  cars = true,
  geometry = false,
) {
  const plan = parkingStudy(id);
  canvas.width = plan.width;
  canvas.height = plan.height;
  const ctx = reviewContext2D(canvas);
  drawCitySurfacePieces(ctx, sheet, plan.pieces);
  if (cars)
    drawCitySurfacePieces(ctx, sheet, plan.bays.filter((b) => b.occupied).map(parkingCarPiece));
  if (geometry) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#73e6b588";
    for (let x = 0; x < plan.width; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, plan.height);
      ctx.stroke();
    }
    for (let y = 0; y < plan.height; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(plan.width, y + 0.5);
      ctx.stroke();
    }
    ctx.strokeStyle = "#ffd479";
    for (const r of plan.drives) ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.width - 1, r.height - 1);
  }
  return plan;
}
/** Use the audited complete cardinal frame, including the side pose's empty
 * upper half. Its projected roof may extend above the ground-space rectangle. */
export function parkingCarPiece(b: ParkingBay): SurfacePiece {
  const view = required(
    VEHICLE_VIEWS.find((v) => v.vehicleId === `compact-${b.color + 1}` && v.direction === b.facing),
  );
  const rect = view.asset.rect;
  const vertical = b.facing === "north" || b.facing === "south";
  return {
    label: `${view.name} parked reference`,
    rect,
    x: b.x + (b.width - rect[2]) / 2,
    y: vertical ? b.y + (b.height - rect[3]) / 2 : b.y + b.height - rect[3],
    role: "paint",
  };
}
export const parkingCase = (id: string) => required(PARKING_CASES.find((c) => c.id === id));

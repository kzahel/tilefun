import { deferredVehicleCandidate } from "./DeferredVehicleCandidate.js";
export function buildTransporterCandidate() {
  return deferredVehicleCandidate(
    "geometry:car-transporter-v2",
    "Single-car transporter",
    "/tilefun/workshop.html?geometry=transporter#/tool/world-geometry",
    "world-geometry",
  );
}

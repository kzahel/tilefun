import { deferredVehicleCandidate } from "./DeferredVehicleCandidate.js";
export function buildTruckBedCandidate() {
  return deferredVehicleCandidate(
    "geometry:truck-bed-v2",
    "Tipping dump-truck bed",
    "/tilefun/workshop.html?geometry=truck-bed#/tool/world-geometry",
    "world-geometry",
  );
}

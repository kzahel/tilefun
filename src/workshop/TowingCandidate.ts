import { deferredVehicleCandidate } from "./DeferredVehicleCandidate.js";
export function buildTowingCandidate() {
  return deferredVehicleCandidate(
    "geometry:wheel-lift-towing-v1",
    "Wheel-lift tow truck",
    "/tilefun/workshop.html?geometry=towing#/tool/world-geometry",
    "world-geometry",
  );
}

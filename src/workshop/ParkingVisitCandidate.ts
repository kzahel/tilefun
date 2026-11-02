import { deferredVehicleCandidate } from "./DeferredVehicleCandidate.js";
export function buildParkingVisitCandidate(city = false) {
  return deferredVehicleCandidate(
    city ? "geometry:city-shopping-v1" : "geometry:parking-visits-v1",
    city ? "Generated city · shopping visits (deferred)" : "Parking and shoppers (deferred)",
    `/tilefun/workshop.html#/tool/parking-lab?play=1${city ? "&city=1" : ""}`,
    "parking-visits",
  );
}

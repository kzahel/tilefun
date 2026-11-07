import { equipmentCandidate } from "./EquipmentCandidate.js";

/** The restored playable dump bed (222), in the ordinary vehicle dynamics course. */
export function buildTruckBedCandidate() {
  return equipmentCandidate(
    "geometry:truck-bed-v2",
    "Tipping dump-truck bed",
    "bed",
    "Jump into the hollow bed, ride while driving and turning, then Tip bed / Lower bed (F, D-pad down or touch). Balls should stay inside while driving and roll out of the open tailgate when tipped.",
  );
}

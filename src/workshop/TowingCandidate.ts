import { equipmentCandidate } from "./EquipmentCandidate.js";
export function buildTowingCandidate() {
  return equipmentCandidate(
    "geometry:wheel-lift-towing-v1",
    "Wheel-lift tow truck",
    "tow",
    "Attach car (F, D-pad down or touch) lifts the parked compact's front wheels; drive, turn and reverse, then Release car.",
  );
}

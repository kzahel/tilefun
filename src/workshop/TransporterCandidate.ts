import { equipmentCandidate } from "./EquipmentCandidate.js";
export function buildTransporterCandidate() {
  return equipmentCandidate(
    "geometry:car-transporter-v2",
    "Single-car transporter",
    "transport",
    "Deploy ramp, drive the beetle up onto the deck, get out and Stow ramp to secure it; drive the transporter, then Deploy ramp and reverse the beetle down. Walk up the ramp on foot too.",
  );
}

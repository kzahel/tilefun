/** Contextual vehicle equipment actions, shared by the request protocol, the
 * authority and the touch/keyboard/controller equipment button. */
export type EquipmentAction = "tip" | "lower" | "attach" | "release" | "deploy" | "stow";
export const EQUIPMENT_ACTIONS: readonly EquipmentAction[] = [
  "tip",
  "lower",
  "attach",
  "release",
  "deploy",
  "stow",
];
export const EQUIPMENT_LABELS: Record<EquipmentAction, string> = {
  tip: "Tip bed",
  lower: "Lower bed",
  attach: "Attach car",
  release: "Release car",
  deploy: "Deploy ramp",
  stow: "Stow ramp",
};

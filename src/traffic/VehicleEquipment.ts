/** Contextual vehicle equipment actions, shared by the request protocol, the
 * authority and the touch/keyboard/controller equipment button. */
import type { ExcavatorAction } from "../shared/ExcavatorInput.js";

type TruckAction = "tip" | "lower" | "attach" | "release" | "deploy" | "stow";
export type CraneToolAction = "crane-hook" | "crane-tool";
export type EquipmentAction = TruckAction | ExcavatorAction | CraneToolAction;
export const isCraneToolAction = (action: string): action is CraneToolAction =>
  action === "crane-hook" || action === "crane-tool";
export const EQUIPMENT_LABELS: Record<EquipmentAction, string> = {
  "crane-hook": "Hook / release",
  "crane-tool": "Switch hook / ball",
  tip: "Tip bed",
  lower: "Lower bed",
  attach: "Attach car",
  release: "Release car",
  deploy: "Deploy ramp",
  stow: "Stow ramp",
  "swing-left": "Swing left",
  "swing-right": "Swing right",
  "boom-down": "Lower boom",
  "boom-up": "Raise boom",
  "stick-in": "Reach in",
  "stick-out": "Reach out",
  "bucket-open": "Open bucket",
  "bucket-curl": "Curl bucket",
};

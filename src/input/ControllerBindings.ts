import type { ActionName } from "./ActionMap.js";

export type ControllerCommand =
  | "up"
  | "down"
  | "left"
  | "right"
  | "confirm"
  | "back"
  | "menu"
  | "interact"
  | "throw"
  | "edit"
  | "map";
export const CONTROLLER_BUTTONS: Record<number, ControllerCommand> = {
  0: "confirm",
  1: "back",
  2: "throw",
  3: "interact",
  4: "edit",
  8: "map",
  9: "menu",
  12: "up",
  13: "down",
  14: "left",
  15: "right",
};
export const CONTROLLER_ACTIONS: Partial<Record<ControllerCommand, ActionName>> = {
  menu: "toggle_menu",
  confirm: "jump",
  back: "context_actions",
  throw: "throw",
  interact: "enter_place",
  edit: "toggle_editor",
  map: "toggle_world_map",
};

export const CONTROLLER_HELD_ACTIONS: Partial<Record<number, ActionName>> = {
  0: "jump",
  2: "throw",
  5: "honk",
  6: "reverse",
  7: "sprint",
  12: "vehicle_lights",
  15: "vehicle_style",
};
const LABELS: Record<number, string> = {
  0: "A",
  1: "B",
  2: "X",
  3: "Y",
  4: "LB",
  5: "RB",
  6: "LT",
  7: "RT",
  8: "View",
  9: "Menu",
  12: "D↑",
  13: "D↓",
  14: "D←",
  15: "D→",
};
export function controllerActionHint(action: ActionName): string {
  const index =
    Object.keys(CONTROLLER_BUTTONS).find((key) =>
      Object.entries(CONTROLLER_ACTIONS).some(
        ([command, binding]) => command === CONTROLLER_BUTTONS[Number(key)] && binding === action,
      ),
    ) ??
    Object.keys(CONTROLLER_HELD_ACTIONS).find(
      (key) => CONTROLLER_HELD_ACTIONS[Number(key)] === action,
    );
  return index === undefined ? "" : (LABELS[Number(index)] ?? "");
}

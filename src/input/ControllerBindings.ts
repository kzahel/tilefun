import type { ActionName } from "./ActionMap.js";

/** Stick axes with a radial dead zone, rescaled to reach 1 at full deflection. */
export function controllerAxes(x: number, y: number): { dx: number; dy: number } {
  const magnitude = Math.hypot(x, y);
  if (magnitude <= 0.18) return { dx: 0, dy: 0 };
  const scale = Math.min(1, (magnitude - 0.18) / 0.82) / magnitude;
  return { dx: x * scale, dy: y * scale };
}

export type ControllerCommand =
  | "up"
  | "down"
  | "left"
  | "right"
  | "confirm"
  | "back"
  | "menu"
  | "interact"
  | "use_item"
  | "edit"
  | "map"
  | "phone";
export const CONTROLLER_BUTTONS: Record<number, ControllerCommand> = {
  0: "confirm",
  1: "back",
  2: "use_item",
  3: "interact",
  4: "edit",
  8: "map",
  9: "menu",
  11: "phone",
  12: "up",
  13: "down",
  14: "left",
  15: "right",
};
export const CONTROLLER_ACTIONS: Partial<Record<ControllerCommand, ActionName>> = {
  menu: "toggle_menu",
  up: "hotbar_swap",
  down: "vehicle_recover",
  left: "hotbar_previous",
  right: "hotbar_next",
  confirm: "jump",
  use_item: "use_item",
  interact: "enter_place",
  edit: "toggle_editor",
  map: "toggle_world_map",
  phone: "toggle_phone",
};

/** Buttons held down. D-pad Up and Right drive vehicle lights and siren style
 * while driving; on foot the D-pad picks from the hotbar (held to keep stepping). */
export const CONTROLLER_HELD_ACTIONS: Partial<Record<number, readonly ActionName[]>> = {
  0: ["jump"],
  2: ["use_item"],
  5: ["honk"],
  6: ["reverse"],
  7: ["sprint"],
  12: ["vehicle_lights"],
  14: ["hotbar_previous"],
  15: ["vehicle_style", "hotbar_next"],
};
/** Add the actions held by the pressed buttons (`pressed(index)`) to `held`. */
export function addHeldActions(pressed: (index: number) => boolean, held: Set<ActionName>): void {
  for (const [index, actions] of Object.entries(CONTROLLER_HELD_ACTIONS))
    if (pressed(Number(index))) for (const action of actions ?? []) held.add(action);
}
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
  11: "R3",
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
    Object.keys(CONTROLLER_HELD_ACTIONS).find((key) =>
      CONTROLLER_HELD_ACTIONS[Number(key)]?.includes(action),
    );
  return index === undefined ? "" : (LABELS[Number(index)] ?? "");
}

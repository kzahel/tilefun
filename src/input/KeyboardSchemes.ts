import { type ActionMapConfig, type ActionName, DEFAULT_ACTION_MAP } from "./ActionMap.js";
import { keyLabel } from "./KeyLabels.js";

export type KeyboardSide = "left" | "right";

export function keyboardSide(value: unknown): KeyboardSide {
  return value === "right" ? "right" : "left";
}

export function otherKeyboardSide(side: KeyboardSide): KeyboardSide {
  return side === "left" ? "right" : "left";
}

/** Actions that belong to one seat rather than to the page. */
export const SEAT_ACTIONS = [
  "move_up",
  "move_down",
  "move_left",
  "move_right",
  "sprint",
  "jump",
  "use_item",
  "honk",
  "reverse",
  "vehicle_lights",
  "vehicle_style",
  "vehicle_recover",
  "enter_place",
  "hotbar_previous",
  "hotbar_next",
  "hotbar_swap",
] as const satisfies readonly ActionName[];
export type SeatAction = (typeof SEAT_ACTIONS)[number];
type SeatKeys = Record<SeatAction, [string, ...string[]]>;

/** Left hand: WASD with nearby actions. */
const LEFT: SeatKeys = {
  move_up: ["KeyW"],
  move_down: ["KeyS"],
  move_left: ["KeyA"],
  move_right: ["KeyD"],
  sprint: ["ShiftLeft"],
  jump: ["Space"],
  use_item: ["KeyQ", "KeyB"],
  honk: ["Space", "KeyH"],
  reverse: ["KeyR"],
  vehicle_lights: ["KeyZ"],
  vehicle_style: ["KeyX"],
  vehicle_recover: ["KeyF"],
  enter_place: ["KeyE"],
  hotbar_previous: ["BracketLeft"],
  hotbar_next: ["BracketRight"],
  hotbar_swap: ["KeyC"],
};

/** Right hand: the arrows with the keys around them. Enter is avoided so a
 * focused button keeps its activation key. */
const RIGHT: SeatKeys = {
  move_up: ["ArrowUp"],
  move_down: ["ArrowDown"],
  move_left: ["ArrowLeft"],
  move_right: ["ArrowRight"],
  sprint: ["ShiftRight"],
  jump: ["Slash"],
  use_item: ["Period"],
  honk: ["Slash"],
  reverse: ["Comma"],
  vehicle_lights: ["KeyL"],
  vehicle_style: ["KeyK"],
  vehicle_recover: ["Semicolon"],
  enter_place: ["Quote"],
  hotbar_previous: ["Minus"],
  hotbar_next: ["Equal"],
  hotbar_swap: ["Backslash"],
};

/** A keyboard guest uses one side. Labs can use the full default map. */
export function seatKeyMap(scheme: KeyboardSide | "solo"): ActionMapConfig {
  if (scheme === "solo") return DEFAULT_ACTION_MAP;
  const keys = scheme === "left" ? LEFT : RIGHT;
  return SEAT_ACTIONS.map((action) => ({ action, keys: [...keys[action]] }));
}

export function keyboardSideLabel(side: KeyboardSide): string {
  if (side === "right") return "arrow keys";
  return [LEFT.move_up, LEFT.move_left, LEFT.move_down, LEFT.move_right]
    .map(([code]) => keyLabel(code))
    .join("");
}

/** A seat's keys without page keys: embedded labs leave Tab, Escape, digits
 * and the other page keys to the Workshop page. */
export function seatOnly(map: ActionMapConfig): ActionMapConfig {
  const seat = new Set<ActionName>(SEAT_ACTIONS);
  return map.filter((binding) => seat.has(binding.action));
}

/** The main player adds page and editor shortcuts to the same play map as a guest. */
export function hostKeyMap(side: KeyboardSide): ActionMapConfig {
  const page = DEFAULT_ACTION_MAP.filter(
    ({ action }) => !SEAT_ACTIONS.some((seat) => seat === action),
  );
  return [
    ...seatKeyMap(side),
    // Leave D available to the guest when the host plays on the right.
    ...page.map((binding) =>
      binding.action === "toggle_base_mode" && side === "right"
        ? { ...binding, keys: ["F4"] }
        : binding,
    ),
  ];
}

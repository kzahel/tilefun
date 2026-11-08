import { type ActionMapConfig, type ActionName, DEFAULT_ACTION_MAP } from "./ActionMap.js";

/**
 * Keyboard ownership for local players (tactical 226). One player owning the
 * keyboard keeps today's full map, both WASD and the arrows. When two players
 * share it, each seat gets a one-handed scheme and the page shell owns the global
 * keys (menu, map, console, debug, editor, zoom), so neither seat can open them by
 * accident. Scheme bindings are provisional until split screen ships (slice 5).
 */
export type KeyboardScheme = "solo" | "left" | "right";

/** Actions that belong to one seat rather than to the page. */
export const SEAT_ACTIONS = [
  "move_up",
  "move_down",
  "move_left",
  "move_right",
  "sprint",
  "jump",
  "throw",
  "honk",
  "reverse",
  "vehicle_lights",
  "vehicle_style",
  "vehicle_recover",
  "enter_place",
] as const satisfies readonly ActionName[];
export type SeatAction = (typeof SEAT_ACTIONS)[number];

/** Page-owned actions available while two players share the keyboard. */
export const SHARED_PAGE_ACTIONS = [
  "toggle_menu",
  "toggle_world_map",
  "toggle_debug",
  "toggle_console",
  "toggle_editor",
  "zoom_0",
  "zoom_1",
  "zoom_2",
  "zoom_3",
  "zoom_4",
  "toggle_first_person",
] as const satisfies readonly ActionName[];

/** Left hand: WASD with nearby actions. */
const LEFT: Record<SeatAction, string[]> = {
  move_up: ["KeyW"],
  move_down: ["KeyS"],
  move_left: ["KeyA"],
  move_right: ["KeyD"],
  sprint: ["ShiftLeft"],
  jump: ["Space"],
  throw: ["KeyQ"],
  honk: ["Space"],
  reverse: ["KeyR"],
  vehicle_lights: ["KeyZ"],
  vehicle_style: ["KeyX"],
  vehicle_recover: ["KeyF"],
  enter_place: ["KeyE"],
};

/** Right hand: the arrows with the keys around them. Enter is avoided so a
 * focused button keeps its activation key. */
const RIGHT: Record<SeatAction, string[]> = {
  move_up: ["ArrowUp"],
  move_down: ["ArrowDown"],
  move_left: ["ArrowLeft"],
  move_right: ["ArrowRight"],
  sprint: ["ShiftRight"],
  jump: ["Slash"],
  throw: ["Period"],
  honk: ["Slash"],
  reverse: ["Comma"],
  vehicle_lights: ["KeyL"],
  vehicle_style: ["KeyK"],
  vehicle_recover: ["Semicolon"],
  enter_place: ["Quote"],
};

function bindings(keys: Record<SeatAction, string[]>): ActionMapConfig {
  return SEAT_ACTIONS.map((action) => ({ action, keys: [...keys[action]] }));
}

/** A seat's key map. "solo" is the whole default map, page keys included. */
export function seatKeyMap(scheme: KeyboardScheme): ActionMapConfig {
  if (scheme === "solo") return DEFAULT_ACTION_MAP;
  return bindings(scheme === "left" ? LEFT : RIGHT);
}

/** A seat's keys without page keys: embedded labs leave Tab, Escape, digits
 * and the other page keys to the Workshop page. */
export function seatOnly(map: ActionMapConfig): ActionMapConfig {
  const seat = new Set<ActionName>(SEAT_ACTIONS);
  return map.filter((binding) => seat.has(binding.action));
}

/** The page shell's keys while two seats share the keyboard. */
export function sharedPageKeyMap(): ActionMapConfig {
  const page = new Set<ActionName>(SHARED_PAGE_ACTIONS);
  return DEFAULT_ACTION_MAP.filter((binding) => page.has(binding.action));
}

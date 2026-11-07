/** Named game actions, decoupled from raw keys. */
export type ActionName =
  // Global
  | "toggle_menu"
  | "toggle_world_map"
  | "toggle_debug"
  | "toggle_editor"
  // Play mode (continuous)
  | "move_up"
  | "move_down"
  | "move_left"
  | "move_right"
  | "sprint"
  | "jump"
  // Editor mode (continuous)
  | "pan_up"
  | "pan_down"
  | "pan_left"
  | "pan_right"
  | "pan_modifier"
  // Editor mode (discrete)
  | "toggle_paint_mode"
  | "cycle_bridge_depth"
  | "cycle_brush_shape"
  | "paint_positive"
  | "paint_unpaint"
  | "toggle_tab"
  // Play mode (discrete)
  | "enter_place"
  | "throw"
  | "honk"
  | "reverse"
  | "vehicle_lights"
  | "vehicle_style"
  | "vehicle_recover"
  | "zoom_0"
  | "zoom_1"
  | "zoom_2"
  | "zoom_3"
  | "zoom_4"
  | "toggle_first_person"
  // Debug (discrete)
  | "toggle_base_mode"
  | "toggle_console";

/** Maps one action to one or more physical keys (`KeyboardEvent.code` values, e.g.
 * "KeyW"), so bindings keep their positions on every keyboard layout. Hints show
 * each key's label on the player's layout (see KeyLabels). */
export interface ActionBinding {
  action: ActionName;
  keys: string[];
}

export type ActionMapConfig = ActionBinding[];

const SHIFT = ["ShiftLeft", "ShiftRight"];

export const DEFAULT_ACTION_MAP: ActionMapConfig = [
  // Global
  { action: "toggle_menu", keys: ["Escape"] },
  { action: "toggle_world_map", keys: ["KeyG"] },
  { action: "toggle_debug", keys: ["F3"] },
  { action: "toggle_console", keys: ["Backquote"] },
  { action: "toggle_editor", keys: ["Tab"] },
  // Play mode movement
  { action: "move_up", keys: ["KeyW", "ArrowUp"] },
  { action: "move_down", keys: ["KeyS", "ArrowDown"] },
  { action: "move_left", keys: ["KeyA", "ArrowLeft"] },
  { action: "move_right", keys: ["KeyD", "ArrowRight"] },
  { action: "sprint", keys: SHIFT },
  { action: "jump", keys: ["Space"] },
  // Editor camera pan (same physical keys, different action context)
  { action: "pan_up", keys: ["KeyW", "ArrowUp"] },
  { action: "pan_down", keys: ["KeyS", "ArrowDown"] },
  { action: "pan_left", keys: ["KeyA", "ArrowLeft"] },
  { action: "pan_right", keys: ["KeyD", "ArrowRight"] },
  { action: "pan_modifier", keys: ["Space"] },
  // Editor shortcuts
  { action: "toggle_paint_mode", keys: ["KeyM"] },
  { action: "cycle_bridge_depth", keys: ["KeyB"] },
  { action: "cycle_brush_shape", keys: ["KeyS"] },
  { action: "paint_positive", keys: ["KeyZ"] },
  { action: "paint_unpaint", keys: ["KeyC"] },
  { action: "toggle_tab", keys: ["KeyT"] },
  // Play mode actions
  { action: "throw", keys: ["KeyB"] },
  { action: "honk", keys: ["Space", "KeyH"] },
  { action: "reverse", keys: ["KeyR"] },
  { action: "vehicle_lights", keys: ["KeyL"] },
  { action: "vehicle_style", keys: ["KeyK"] },
  { action: "vehicle_recover", keys: ["KeyF"] },
  { action: "enter_place", keys: ["KeyE"] },
  // Play mode zoom presets
  { action: "zoom_0", keys: ["Digit0"] },
  { action: "zoom_1", keys: ["Digit1"] },
  { action: "zoom_2", keys: ["Digit2"] },
  { action: "zoom_3", keys: ["Digit3"] },
  { action: "zoom_4", keys: ["Digit4"] },
  // Experimental first-person view (tactical 229)
  { action: "toggle_first_person", keys: ["KeyV"] },
  // Debug
  { action: "toggle_base_mode", keys: ["KeyD"] },
];

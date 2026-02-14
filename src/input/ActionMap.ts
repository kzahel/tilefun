/** Named game actions, decoupled from raw keys. */
export type ActionName =
  // Global
  | "toggle_menu"
  | "toggle_debug"
  | "toggle_editor"
  // Play mode (continuous)
  | "move_up"
  | "move_down"
  | "move_left"
  | "move_right"
  | "sprint"
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
  // Debug (discrete)
  | "toggle_base_mode"
  | "toggle_console";

/** Maps one action to one or more keys (KeyboardEvent.key values). */
export interface ActionBinding {
  action: ActionName;
  keys: string[];
}

export type ActionMapConfig = ActionBinding[];

export const DEFAULT_ACTION_MAP: ActionMapConfig = [
  // Global
  { action: "toggle_menu", keys: ["Escape"] },
  { action: "toggle_debug", keys: ["F3"] },
  { action: "toggle_console", keys: ["`"] },
  { action: "toggle_editor", keys: ["Tab"] },
  // Play mode movement
  { action: "move_up", keys: ["w", "ArrowUp"] },
  { action: "move_down", keys: ["s", "ArrowDown"] },
  { action: "move_left", keys: ["a", "ArrowLeft"] },
  { action: "move_right", keys: ["d", "ArrowRight"] },
  { action: "sprint", keys: ["Shift"] },
  // Editor camera pan (same physical keys, different action context)
  { action: "pan_up", keys: ["w", "ArrowUp"] },
  { action: "pan_down", keys: ["s", "ArrowDown"] },
  { action: "pan_left", keys: ["a", "ArrowLeft"] },
  { action: "pan_right", keys: ["d", "ArrowRight"] },
  { action: "pan_modifier", keys: [" "] },
  // Editor shortcuts
  { action: "toggle_paint_mode", keys: ["m", "M"] },
  { action: "cycle_bridge_depth", keys: ["b", "B"] },
  { action: "cycle_brush_shape", keys: ["s", "S"] },
  { action: "paint_positive", keys: ["z"] },
  { action: "paint_unpaint", keys: ["c"] },
  { action: "toggle_tab", keys: ["t", "T"] },
  // Debug
  { action: "toggle_base_mode", keys: ["d", "D"] },
];

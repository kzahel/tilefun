/**
 * Keyboard focus rule per page shell (tactical 226). The game page listens on
 * the window and its DOM UI stops the keys it consumes. An embedded lab plays
 * only while focus is inside its own root and on no form control there, so
 * Workshop fields, selects and buttons keep their keys.
 */

interface FocusTarget {
  tagName?: string;
  type?: string;
  isContentEditable?: boolean;
}

interface FocusRoot {
  contains(node: unknown): boolean;
}

const CONTROLS = new Set([
  "BUTTON",
  "SELECT",
  "TEXTAREA",
  "A",
  "SUMMARY",
  "OPTION",
  "AUDIO",
  "VIDEO",
]);

/** Whether a focused element uses keys itself (text entry or a form control). */
export function ownsKeys(target: unknown): boolean {
  if (!target || typeof target !== "object") return false;
  const element = target as FocusTarget;
  if (element.isContentEditable) return true;
  const tag = element.tagName?.toUpperCase();
  if (!tag) return false;
  // Text entry, checkboxes (Space), ranges and radios (arrows) all use keys.
  if (tag === "INPUT") return element.type !== "hidden";
  return CONTROLS.has(tag);
}

/**
 * Whether gameplay should take a key event from `target`: always on the game page
 * (no root); for an embedded lab, only inside `root` and not on a control.
 */
export function acceptsGameKey(target: unknown, root?: FocusRoot | null): boolean {
  if (!root) return true;
  return !!target && root.contains(target) && !ownsKeys(target);
}

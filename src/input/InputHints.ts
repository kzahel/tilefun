import { type ActionName, DEFAULT_ACTION_MAP } from "./ActionMap.js";
import { controllerActionHint } from "./ControllerBindings.js";
import { keyLabel, learnKeyLabel, loadLayoutLabels } from "./KeyLabels.js";
export type InputSource = "keyboard" | "controller" | "touch";
let source: InputSource = "keyboard";
export function noteInputSource(next: InputSource): void {
  source = next;
}
export function inputHint(keyboard: string, controller: string): string {
  return source === "touch" ? "" : source === "controller" ? controller : keyboard;
}
if (typeof window !== "undefined") {
  window.addEventListener(
    "keydown",
    (event) => {
      noteInputSource("keyboard");
      learnKeyLabel(event);
    },
    true,
  );
  void loadLayoutLabels();
  window.addEventListener("focus", () => void loadLayoutLabels());
  window.addEventListener(
    "pointerdown",
    (event) => noteInputSource(event.pointerType === "touch" ? "touch" : "keyboard"),
    true,
  );
}

/** The keyboard label of an action's first binding, on the player's layout. */
export function keyboardHint(action: ActionName): string {
  const code = DEFAULT_ACTION_MAP.find((binding) => binding.action === action)?.keys[0];
  return code ? keyLabel(code) : "";
}

/** The four movement keys in up/left/down/right order ("WASD" on QWERTY). */
export function movementKeysHint(): string {
  return (["move_up", "move_left", "move_down", "move_right"] as const).map(keyboardHint).join("");
}

/** Display the same default semantic bindings that input actually consumes. */
export function actionHint(action: ActionName): string {
  return inputHint(keyboardHint(action), controllerActionHint(action));
}

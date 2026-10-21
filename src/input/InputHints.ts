import { type ActionName, DEFAULT_ACTION_MAP } from "./ActionMap.js";
import { controllerActionHint } from "./ControllerBindings.js";
export type InputSource = "keyboard" | "controller" | "touch";
let source: InputSource = "keyboard";
export function noteInputSource(next: InputSource): void {
  source = next;
}
export function inputHint(keyboard: string, controller: string): string {
  return source === "touch" ? "" : source === "controller" ? controller : keyboard;
}
if (typeof window !== "undefined") {
  window.addEventListener("keydown", () => noteInputSource("keyboard"), true);
  window.addEventListener(
    "pointerdown",
    (event) => noteInputSource(event.pointerType === "touch" ? "touch" : "keyboard"),
    true,
  );
}

/** Display the same default semantic bindings that input actually consumes. */
export function actionHint(action: ActionName): string {
  const key = DEFAULT_ACTION_MAP.find((binding) => binding.action === action)?.keys[0] ?? "";
  return inputHint(
    key === " " ? "Space" : key.length === 1 ? key.toUpperCase() : key,
    controllerActionHint(action),
  );
}

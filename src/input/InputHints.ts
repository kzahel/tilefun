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

/** Request fullscreen once per page load on touch-first devices. */
export function enableFirstTouchFullscreen(): () => void {
  const root = document.documentElement;
  const detach = () => document.removeEventListener("pointerup", onPointerUp, true);

  async function onPointerUp(event: PointerEvent): Promise<void> {
    if (event.pointerType !== "touch" || !event.isPrimary || !event.isTrusted) return;
    // Consume the attempt before requesting, so exiting fullscreen stays exited.
    detach();
    if (document.fullscreenElement) return;
    try {
      // Fullscreen the whole page so DOM menus remain alongside the game canvas.
      await root.requestFullscreen({ navigationUI: "hide" });
    } catch {
      // Unsupported/denied fullscreen must not interrupt play or show a fatal error.
    }
  }

  if (
    window.matchMedia("(pointer: coarse)").matches &&
    document.fullscreenEnabled &&
    typeof root.requestFullscreen === "function"
  ) {
    // Touch grants activation on release. Capture also sees taps in menus whose
    // handlers stop propagation; leave the original touch/click action intact.
    document.addEventListener("pointerup", onPointerUp, { capture: true, passive: true });
  }
  return detach;
}

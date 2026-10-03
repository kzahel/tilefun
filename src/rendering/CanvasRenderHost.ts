import { CanvasRenderBackend } from "./CanvasRenderBackend.js";
import type { RenderHost } from "./RenderHost.js";

/** Default composition; world and independent HUD/debug UI share one 2D surface. */
export function createCanvasRenderHost(canvas: HTMLCanvasElement): RenderHost {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("Failed to get 2D context");
  const renderer = new CanvasRenderBackend(ctx, new Map());
  const lost = (event: Event) => event.preventDefault();
  const restored = () => renderer.recover();
  canvas.addEventListener("contextlost", lost);
  canvas.addEventListener("contextrestored", restored);
  let disposed = false;
  return {
    renderer,
    uiContext: ctx,
    setAssets: (assets, graph) => renderer.configureAssets(assets, graph),
    resize: (width, height) => renderer.resize(width, height),
    beginFrame() {}, // Clear pass already clears the shared surface.
    dispose() {
      if (disposed) return;
      disposed = true;
      canvas.removeEventListener("contextlost", lost);
      canvas.removeEventListener("contextrestored", restored);
      renderer.dispose();
    },
  };
}

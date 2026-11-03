import { CanvasRenderBackend } from "./CanvasRenderBackend.js";
import type { RenderHost } from "./RenderHost.js";
import { WORLD_RASTER_PAD, WorldRasterFrame } from "./WorldRasterFrame.js";

/** Padded world surface, presented once onto the independent HUD/input canvas. */
export function createCanvasRenderHost(canvas: HTMLCanvasElement): RenderHost {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("Failed to get 2D context");
  const world = new OffscreenCanvas(
    canvas.width + WORLD_RASTER_PAD * 2,
    canvas.height + WORLD_RASTER_PAD * 2,
  );
  const worldContext = world.getContext("2d");
  if (!worldContext) throw Error("World canvas unavailable");
  const renderer = new CanvasRenderBackend(
    worldContext as unknown as CanvasRenderingContext2D,
    new Map(),
  );
  renderer.worldRaster = true;
  const frame = new WorldRasterFrame();
  const lost = (event: Event) => event.preventDefault();
  const restored = () => renderer.recover();
  canvas.addEventListener("contextlost", lost);
  canvas.addEventListener("contextrestored", restored);
  world.addEventListener("contextlost", lost);
  world.addEventListener("contextrestored", restored);
  let disposed = false;
  return {
    renderer,
    uiContext: ctx,
    setAssets: (assets, graph) => renderer.configureAssets(assets, graph),
    resize(width, height) {
      canvas.width = width;
      canvas.height = height;
      renderer.resize(width + WORLD_RASTER_PAD * 2, height + WORLD_RASTER_PAD * 2);
    },
    beginFrame() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
    beginWorld(camera) {
      frame.begin(camera);
    },
    endWorld() {
      const offset = frame.end();
      if (!offset) return;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(world, offset.x - WORLD_RASTER_PAD, offset.y - WORLD_RASTER_PAD);
      ctx.imageSmoothingEnabled = false;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      frame.end();
      canvas.removeEventListener("contextlost", lost);
      canvas.removeEventListener("contextrestored", restored);
      world.removeEventListener("contextlost", lost);
      world.removeEventListener("contextrestored", restored);
      renderer.dispose();
    },
  };
}

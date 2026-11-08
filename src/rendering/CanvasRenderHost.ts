import type { Camera } from "./Camera.js";
import { CanvasRenderBackend } from "./CanvasRenderBackend.js";
import type { RenderHost } from "./RenderHost.js";
import { isWholeCanvas, type RenderRegion } from "./ViewLayout.js";
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
  let region: RenderRegion | undefined;
  let views = 0;
  const beginView = (camera: Camera, viewRegion?: RenderRegion) => {
    // A later view starts from a clear surface, as on the GPU host.
    if (views++ > 0) worldContext.clearRect(0, 0, world.width, world.height);
    frame.begin(camera);
    region = viewRegion;
  };
  const endView = () => {
    const offset = frame.end(),
      r = region;
    region = undefined;
    if (!offset) return;
    ctx.imageSmoothingEnabled = true;
    if (!r || isWholeCanvas(r, canvas.width, canvas.height))
      ctx.drawImage(world, offset.x - WORLD_RASTER_PAD, offset.y - WORLD_RASTER_PAD);
    else {
      // The view was drawn in the world surface's top-left corner (its size plus
      // padding; the clear pass covers the padding too).
      ctx.save();
      ctx.beginPath();
      if (r.clip) for (const p of r.clip) ctx.lineTo(p.x, p.y);
      else ctx.rect(r.x, r.y, r.width, r.height);
      ctx.clip();
      const w = r.width + WORLD_RASTER_PAD * 2,
        h = r.height + WORLD_RASTER_PAD * 2;
      const x = r.x + offset.x - WORLD_RASTER_PAD,
        y = r.y + offset.y - WORLD_RASTER_PAD;
      ctx.drawImage(world, 0, 0, w, h, x, y, w, h);
      ctx.restore();
    }
    ctx.imageSmoothingEnabled = false;
  };
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
      views = 0;
    },
    beginWorld: (camera) => beginView(camera),
    endWorld: endView,
    beginView,
    endView,
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

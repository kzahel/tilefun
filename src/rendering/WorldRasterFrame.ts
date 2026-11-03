import { PIXEL_SCALE } from "../config/constants.js";
import type { Camera } from "./Camera.js";
import type { RenderView } from "./RenderFrame.js";

/** Guard pixels are rendered, not stretched from the viewport edge. */
export const WORLD_RASTER_PAD = 2;

export function worldRasterOffset(view: RenderView, snapped = false) {
  const x = view.viewportWidth / 2 - view.x * PIXEL_SCALE * view.zoom;
  const y = view.viewportHeight / 2 - view.y * PIXEL_SCALE * view.zoom;
  return { x: snapped ? 0 : x - Math.round(x), y: snapped ? 0 : y - Math.round(y) };
}

/** Scope the aligned projection to world collection too (overlays/clips included).
 * Logical picking and HUD projection resume before UI is drawn. */
export class WorldRasterFrame {
  private camera: Camera | undefined;
  private snapped = false;
  private raster = false;
  begin(camera: Camera) {
    if (this.camera) throw Error("World raster frame already active");
    this.camera = camera;
    this.snapped = camera.pixelSnap;
    this.raster = camera.worldRaster;
    camera.pixelSnap = true;
    camera.worldRaster = true;
  }
  end() {
    const camera = this.camera;
    if (!camera) return undefined;
    this.camera = undefined;
    camera.pixelSnap = this.snapped;
    camera.worldRaster = this.raster;
    return worldRasterOffset(camera, this.snapped);
  }
}

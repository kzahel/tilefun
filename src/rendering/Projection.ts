import { PIXEL_SCALE } from "../config/constants.js";
import type { RenderView } from "./RenderFrame.js";

/** The fixed game projection, before each primitive's explicit pixel rounding.
 * Ground Y and height Z both affect screen Y. This is not a generic orbit camera.
 */
export function projectWorld(view: RenderView, x: number, y: number, z = 0) {
  const scale = PIXEL_SCALE * view.zoom;
  return {
    sx: (x - view.x) * scale + view.viewportWidth / 2,
    sy: (y - z - view.y) * scale + view.viewportHeight / 2,
  };
}

/** Inverse on a specified horizontal plane; a screen point alone has no 3D inverse. */
export function unprojectPlane(view: RenderView, sx: number, sy: number, z = 0) {
  const scale = PIXEL_SCALE * view.zoom;
  return {
    wx: (sx - view.viewportWidth / 2) / scale + view.x,
    wy: (sy - view.viewportHeight / 2) / scale + view.y + z,
  };
}

import { PIXEL_SCALE } from "../config/constants.js";
import type { RenderView } from "./RenderFrame.js";

/** The fixed game projection, before each primitive's explicit pixel rounding.
 * With pixelSnap, quantize the translation once for every world layer. Keep
 * camera follow and world positions continuous; local geometry never acquires
 * a changing fractional phase merely because the camera is settling.
 * Ground Y and height Z both affect screen Y. This is not a generic orbit camera.
 */
export function projectWorld(view: RenderView, x: number, y: number, z = 0) {
  const scale = PIXEL_SCALE * view.zoom;
  if (view.pixelSnap) {
    return {
      sx: x * scale + Math.round(view.viewportWidth / 2 - view.x * scale),
      sy: (y - z) * scale + Math.round(view.viewportHeight / 2 - view.y * scale),
    };
  }
  return {
    sx: (x - view.x) * scale + view.viewportWidth / 2,
    sy: (y - z - view.y) * scale + view.viewportHeight / 2,
  };
}

/** Inverse on a specified horizontal plane; a screen point alone has no 3D inverse. */
export function unprojectPlane(view: RenderView, sx: number, sy: number, z = 0) {
  const scale = PIXEL_SCALE * view.zoom;
  if (view.pixelSnap) {
    return {
      wx: (sx - Math.round(view.viewportWidth / 2 - view.x * scale)) / scale,
      wy: (sy - Math.round(view.viewportHeight / 2 - view.y * scale)) / scale + z,
    };
  }
  return {
    wx: (sx - view.viewportWidth / 2) / scale + view.x,
    wy: (sy - view.viewportHeight / 2) / scale + view.y + z,
  };
}

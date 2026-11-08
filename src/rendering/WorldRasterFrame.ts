import { PIXEL_SCALE } from "../config/constants.js";
import type { Camera } from "./Camera.js";
import type { RenderView } from "./RenderFrame.js";
import type { RenderRegion } from "./ViewLayout.js";

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

const KEEP_ALL = [0, 0, 1] as const;

/** GL state that composes the world target's top-left view into a canvas region.
 * Canvas pixels have a top-left origin; GL rows and `gl_FragCoord` count from the
 * bottom. Written into a reused record each present. */
export interface WorldComposite {
  /** Region size (the shader's `viewport`). */
  width: number;
  height: number;
  /** Target texel sampled at the region's bottom-left corner (the shader's `offset`). */
  offsetX: number;
  offsetY: number;
  /** Keep maskX * fragX + maskY * fragY + maskZ >= 0 in `gl_FragCoord` pixels. */
  maskX: number;
  maskY: number;
  maskZ: number;
  /** A partial region draws through this GL viewport (x, bottom-up y). */
  partial: boolean;
  viewportX: number;
  viewportY: number;
}

export function worldComposite(
  out: WorldComposite,
  canvas: { readonly width: number; readonly height: number },
  targetHeight: number,
  offsetX: number,
  offsetY: number,
  region?: RenderRegion,
): WorldComposite {
  const x = region?.x ?? 0,
    y = region?.y ?? 0;
  out.width = region?.width ?? canvas.width;
  out.height = region?.height ?? canvas.height;
  // The view occupies the target's top-left corner (its size plus padding).
  out.offsetX = WORLD_RASTER_PAD - offsetX;
  out.offsetY = targetHeight - out.height - WORLD_RASTER_PAD + offsetY;
  // Canvas y = height - fragY: a*x + b*(height - fragY) + c >= 0.
  const mask = region?.mask ?? KEEP_ALL;
  out.maskX = mask[0];
  out.maskY = -mask[1];
  out.maskZ = mask[1] * canvas.height + mask[2];
  out.partial = x !== 0 || y !== 0 || out.width !== canvas.width || out.height !== canvas.height;
  out.viewportX = x;
  out.viewportY = canvas.height - y - out.height;
  return out;
}

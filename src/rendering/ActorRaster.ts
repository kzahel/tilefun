import type { Camera } from "./Camera.js";
import type { RasterSurface } from "./RasterSurface.js";
import type { SpriteItem } from "./SceneItem.js";

/** Special vehicle sprite families share the actor policy with ordinary sprites. */
export function drawActorImage(
  ctx: RasterSurface,
  camera: Camera,
  item: SpriteItem,
  image: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (camera.worldRaster && item.subpixel && ctx.drawSubpixelImage)
    ctx.drawSubpixelImage(image, sx, sy, sw, sh, x, y, Math.round(w), Math.round(h));
  else ctx.drawImage(image, sx, sy, sw, sh, Math.floor(x), Math.floor(y), w, h);
}

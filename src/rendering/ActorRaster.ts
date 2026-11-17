import type { RasterSurface } from "./RasterSurface.js";

/** Special vehicle sprite families share the actor policy with ordinary sprites. */
export function drawActorImage(
  ctx: RasterSurface,
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
  ctx.drawImage(image, sx, sy, sw, sh, Math.floor(x), Math.floor(y), w, h);
}

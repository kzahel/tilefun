import type { Spritesheet } from "../assets/Spritesheet.js";
import type { SurfacePiece } from "../road/CitySurfaceRecipes.js";

/** Native surface placements can be drawn into a chunk cache or a review canvas. */
export function drawCitySurfacePieces(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  sheet: Spritesheet,
  pieces: readonly SurfacePiece[],
  originX = 0,
  originY = 0,
  scale = 1,
): void {
  ctx.imageSmoothingEnabled = false;
  for (const p of pieces) {
    const [x, y, w, h] = p.rect;
    ctx.drawImage(
      sheet.image,
      x,
      y,
      w,
      h,
      (p.x - originX) * scale,
      (p.y - originY) * scale,
      w * scale,
      h * scale,
    );
  }
}

import type { Spritesheet } from "../assets/Spritesheet.js";
import { drawCitySurfacePieces } from "../rendering/CitySurfaceRenderer.js";
import {
  type CitySurfaceCase,
  composeCitySurface,
  SURFACE_COLS,
  SURFACE_ROWS,
} from "../road/CitySurfaceRecipes.js";
import { reviewContext2D } from "./reviewCanvas.js";

/** The shared composer supplies all surface decisions; the lab only projects pixels. */
export function drawSurfaceShowcase(
  canvas: HTMLCanvasElement,
  scene: CitySurfaceCase,
  sheet: Spritesheet,
  geometry: boolean,
) {
  canvas.width = SURFACE_COLS * 16 * 2;
  canvas.height = SURFACE_ROWS * 16 * 2;
  const ctx = reviewContext2D(canvas);
  ctx.imageSmoothingEnabled = false;
  const pieces = composeCitySurface(scene);
  drawCitySurfacePieces(ctx, sheet, pieces, 0, 0, 2);
  if (geometry) {
    ctx.strokeStyle = "#69dcac55";
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  }
  return { width: SURFACE_COLS * 16, height: SURFACE_ROWS * 16, parts: pieces.length };
}

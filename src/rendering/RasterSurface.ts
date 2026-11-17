/** Native review drawing operations; no GPU world-pass adapters. */
export type RasterSurface = Pick<
  CanvasRenderingContext2D,
  | "canvas"
  | "save"
  | "restore"
  | "translate"
  | "scale"
  | "rotate"
  | "drawImage"
  | "fillRect"
  | "beginPath"
  | "rect"
  | "clip"
  | "ellipse"
  | "fill"
  | "globalAlpha"
  | "fillStyle"
  | "imageSmoothingEnabled"
>;

const revisions = new WeakMap<object, number>();
/** In-place raster preparation must publish a change even before completion. */
export function touchRaster(source: object): void {
  revisions.set(source, rasterRevision(source) + 1);
}
export function rasterRevision(source: object): number {
  return revisions.get(source) ?? 0;
}

/** Request calling-thread rasterization. Completion can still be deferred until
 * pixels are read; terrain finishes each changed row inside its preparation budget.
 * A GPU-backed 2D canvas only records
 * its draws there and executes them in the GPU process: a terrain chunk's tile
 * blits cost 10–30 ms on a phone that way, outside the caller's time budget, and
 * hold up the frame. */
export function cpuRasterCanvas(width: number, height: number): OffscreenCanvas {
  const canvas = new OffscreenCanvas(width, height);
  canvas.getContext("2d", { willReadFrequently: true });
  return canvas;
}

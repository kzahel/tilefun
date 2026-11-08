/**
 * Touch and pointer coordinates for canvases that do not fill the window
 * (tactical 226): embedded labs show a 960×640 canvas at 100% width, and split
 * screen gives each player a region of one canvas. Controls lay out and hit-test
 * in CSS pixels relative to the canvas, then draw scaled into canvas pixels.
 */

/** A region of the canvas in CSS pixels, relative to its top-left corner. */
export interface ViewRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CanvasLike {
  width: number;
  height: number;
  clientWidth?: number;
  clientHeight?: number;
  getBoundingClientRect?(): { left: number; top: number; width?: number; height?: number };
}

/** A client-space point relative to the canvas's top-left corner, in CSS pixels. */
export function canvasPoint(
  canvas: CanvasLike,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect?.();
  return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
}

/** Canvas pixels per CSS pixel (1 for a full-window canvas sized to its CSS box). */
export function canvasScale(canvas: CanvasLike): { x: number; y: number } {
  return {
    x: canvas.clientWidth ? canvas.width / canvas.clientWidth : 1,
    y: canvas.clientHeight ? canvas.height / canvas.clientHeight : 1,
  };
}

/** The whole canvas as a region in CSS pixels. */
export function wholeCanvas(canvas: CanvasLike): ViewRegion {
  return {
    x: 0,
    y: 0,
    width: canvas.clientWidth || canvas.width,
    height: canvas.clientHeight || canvas.height,
  };
}

export function inRegion(region: ViewRegion, point: { x: number; y: number }): boolean {
  return (
    point.x >= region.x &&
    point.y >= region.y &&
    point.x < region.x + region.width &&
    point.y < region.y + region.height
  );
}

/** The view under a point (CSS pixels relative to the canvas), or -1. Later
 * regions win where regions overlap, matching draw order. */
export function viewAt(regions: readonly ViewRegion[], point: { x: number; y: number }): number {
  for (let i = regions.length - 1; i >= 0; i--) {
    const region = regions[i];
    if (region && inRegion(region, point)) return i;
  }
  return -1;
}

/** Draw in CSS pixels on a canvas whose pixel size differs from its CSS box. */
export function withCssPixels(
  ctx: CanvasRenderingContext2D,
  canvas: CanvasLike,
  draw: () => void,
): void {
  const scale = canvasScale(canvas);
  if (scale.x === 1 && scale.y === 1) {
    draw();
    return;
  }
  ctx.save();
  ctx.scale(scale.x, scale.y);
  try {
    draw();
  } finally {
    ctx.restore();
  }
}

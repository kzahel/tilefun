/**
 * Touch and pointer coordinates for canvases that do not fill the window
 * (tactical 226): embedded labs show a 960×640 canvas at 100% width, and split
 * screen gives each player a region of one canvas. Controls lay out and hit-test
 * in CSS pixels relative to the canvas, then draw scaled into canvas pixels.
 */

import type { RenderRegion } from "../rendering/ViewLayout.js";

/** A region of the canvas in CSS pixels, relative to its top-left corner: the
 * rectangle of a view's `RenderRegion` (canvas pixels) as touch input reads it
 * (`cssRegion`). */
export type ViewRegion = Pick<RenderRegion, "x" | "y" | "width" | "height">;

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

/** A view's region (canvas pixels) in CSS pixels of the canvas. */
export function cssRegion(canvas: CanvasLike, region: ViewRegion): ViewRegion {
  const scale = canvasScale(canvas);
  return {
    x: region.x / scale.x,
    y: region.y / scale.y,
    width: region.width / scale.x,
    height: region.height / scale.y,
  };
}

/** A client-space point in canvas pixels relative to a view's region (canvas
 * pixels), or undefined outside it (unless `anywhere`): where a tap or click lands
 * in that view. */
export function regionPoint(
  canvas: CanvasLike,
  region: ViewRegion,
  clientX: number,
  clientY: number,
  anywhere = false,
): { x: number; y: number } | undefined {
  const rect = canvas.getBoundingClientRect?.();
  if (rect && (!rect.width || !rect.height)) return undefined;
  const x = (clientX - (rect?.left ?? 0)) * (rect?.width ? canvas.width / rect.width : 1);
  const y = (clientY - (rect?.top ?? 0)) * (rect?.height ? canvas.height / rect.height : 1);
  const local = { x: x - region.x, y: y - region.y };
  return anywhere || inRegion({ ...region, x: 0, y: 0 }, local) ? local : undefined;
}

/** A view region's distance from the page's left, right and bottom edges in CSS
 * pixels: page controls fixed to those edges move inside the view by it. */
export interface PageInset {
  left: number;
  right: number;
  bottom: number;
}

export const NO_INSET: PageInset = { left: 0, right: 0, bottom: 0 };

export function pageInset(
  canvas: CanvasLike,
  region: ViewRegion,
  page: { width: number; height: number },
): PageInset {
  const rect = canvas.getBoundingClientRect?.();
  const css = cssRegion(canvas, region);
  const left = (rect?.left ?? 0) + css.x;
  const top = (rect?.top ?? 0) + css.y;
  return { left, right: page.width - left - css.width, bottom: page.height - top - css.height };
}

/** Move a fixed page control by CSS pixels; none leaves it at its own place. */
export function shift(element: HTMLElement, x: number, y: number): void {
  const value = Math.round(x) || Math.round(y) ? `${Math.round(x)}px ${Math.round(y)}px` : "";
  if (element.style.translate !== value) element.style.translate = value;
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

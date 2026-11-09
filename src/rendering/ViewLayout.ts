/**
 * Split-screen regions for one render host (tactical 226). Each view draws the
 * world into its own region of the canvas; `RenderHost.beginView` composes it.
 */

/** A view's region of the canvas in canvas pixels, top-left origin. A diagonal
 * view covers its bounding rectangle and keeps one half-plane of it. */
export interface RenderRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Keep a*x + b*y + c >= 0 (canvas pixels); the GPU present discards the rest. */
  readonly mask?: readonly [number, number, number];
}

/** Fixed layouts: one view, two side by side, a 2×2 grid, or a diagonal split. */
export type ViewLayout = "1" | "2" | "4" | "diagonal";

export interface LayoutView {
  readonly region: RenderRegion;
  /** Region-local pixel where the view's subject belongs: the centre, or a
   * diagonal half's centroid. */
  readonly focusX: number;
  readonly focusY: number;
}

const rect = (x: number, y: number, width: number, height: number): LayoutView => ({
  region: { x, y, width, height },
  focusX: width / 2,
  focusY: height / 2,
});

/** Integer regions that tile the canvas exactly, with no gaps or overlap. */
export function layoutViews(layout: ViewLayout, width: number, height: number): LayoutView[] {
  const w = Math.max(1, Math.round(width)),
    h = Math.max(1, Math.round(height));
  const halfX = Math.floor(w / 2),
    halfY = Math.floor(h / 2);
  switch (layout) {
    case "1":
      return [rect(0, 0, w, h)];
    case "2":
      return [rect(0, 0, halfX, h), rect(halfX, 0, w - halfX, h)];
    case "4":
      return [
        rect(0, 0, halfX, halfY),
        rect(halfX, 0, w - halfX, halfY),
        rect(0, halfY, halfX, h - halfY),
        rect(halfX, halfY, w - halfX, h - halfY),
      ];
    case "diagonal": {
      // Split along the top-left → bottom-right diagonal, f(x, y) = h*x - w*y.
      // Both views cover the canvas; view 0 keeps the lower-left half.
      const whole = { x: 0, y: 0, width: w, height: h };
      return [
        {
          region: { ...whole, mask: [-h, w, 0] },
          focusX: w / 3,
          focusY: (2 * h) / 3,
        },
        {
          region: { ...whole, mask: [h, -w, 0] },
          focusX: (2 * w) / 3,
          focusY: h / 3,
        },
      ];
    }
  }
}

/** Layout regions kept until the layout or canvas size changes, so a steady frame
 * reuses the same region objects. */
export class ViewLayouts {
  private key = "";
  private views: readonly LayoutView[] = [];

  get(layout: ViewLayout, width: number, height: number): readonly LayoutView[] {
    const key = `${layout} ${width}×${height}`;
    if (key !== this.key) {
      this.key = key;
      this.views = layoutViews(layout, width, height);
    }
    return this.views;
  }
}

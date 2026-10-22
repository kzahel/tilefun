import type { Spritesheet } from "../assets/Spritesheet.js";
import { drawOverlayGeometry } from "./CanvasOverlayRenderer.js";
import type { OverlayDraw } from "./OverlayFrame.js";
import { touchRaster } from "./RasterSurface.js";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_ENTRIES = 32;
const fields: (keyof OverlayDraw)[] = [
  "kind",
  "fill",
  "stroke",
  "lineWidth",
  "text",
  "font",
  "centered",
  "sheetKey",
  "srcX",
  "srcY",
  "srcWidth",
  "srcHeight",
  "alpha",
];
interface Entry {
  image: HTMLCanvasElement;
  items: OverlayDraw[];
  x: number;
  y: number;
}

/** Local elevated-surface images, with the same Canvas rasterization/subpixel
 * phase as the reference. Ground patterns belong in terrain chunks instead.
 * No screen-sized image per slab, and no camera position in the resource key.
 */
export class GpuOverlayResources {
  private readonly entries = new Map<string, Entry>();
  bytes = 0;
  builds = 0;
  hits = 0;
  culled = 0;
  constructor(private readonly releaseImage: (image: HTMLCanvasElement) => void) {}
  get size() {
    return this.entries.size;
  }

  /** Undefined falls back to the general overlay path; null is entirely culled. */
  get(
    key: string,
    items: readonly OverlayDraw[],
    width: number,
    height: number,
    sheets: ReadonlyMap<string, Spritesheet>,
  ): { image: HTMLCanvasElement; x: number; y: number } | null | undefined {
    if (!items.length) return null;
    // Current physical surfaces use rectangles/lines. Text and arbitrary editor
    // overlays retain the existing general path rather than guessing glyph bounds.
    if (items.some((d) => d.kind !== "rect" && d.kind !== "line")) return undefined;
    const old = this.entries.get(key);
    const first = items[0],
      previous = old?.items[0];
    if (old && first && previous && items.length === old.items.length) {
      const dx = Math.round(first.x - previous.x),
        dy = Math.round(first.y - previous.y);
      const equal = (a: number, b: number) => Math.abs(a - b) < 1e-7;
      const unchanged = items.every((d, i) => {
        const p = old.items[i];
        return (
          p &&
          fields.every((f) => d[f] === p[f]) &&
          equal(d.x, p.x + dx) &&
          equal(d.y, p.y + dy) &&
          equal(d.width, p.width + (d.kind === "line" ? dx : 0)) &&
          equal(d.height, p.height + (d.kind === "line" ? dy : 0))
        );
      });
      if (unchanged) {
        this.entries.delete(key);
        this.entries.set(key, old);
        const x = old.x + dx,
          y = old.y + dy;
        if (x >= width || y >= height || x + old.image.width <= 0 || y + old.image.height <= 0) {
          this.culled++;
          return null;
        }
        this.hits++;
        return { image: old.image, x, y };
      }
    }
    let left = Infinity,
      top = Infinity,
      right = -Infinity,
      bottom = -Infinity;
    for (const d of items) {
      const x2 = d.kind === "line" ? d.width : d.x + d.width;
      const y2 = d.kind === "line" ? d.height : d.y + d.height;
      const pad = d.stroke ? d.lineWidth / 2 : 0;
      left = Math.min(left, d.x - pad, x2 - pad);
      top = Math.min(top, d.y - pad, y2 - pad);
      right = Math.max(right, d.x + pad, x2 + pad);
      bottom = Math.max(bottom, d.y + pad, y2 + pad);
    }
    // Integer crop origins preserve the full-screen reference's raster phase.
    const x = Math.floor(left) - 2,
      y = Math.floor(top) - 2;
    const w = Math.ceil(right) + 2 - x,
      h = Math.ceil(bottom) + 2 - y;
    if (x >= width || y >= height || x + w <= 0 || y + h <= 0) {
      this.culled++;
      return null;
    }
    const bytes = w * h * 4;
    if (!Number.isFinite(bytes) || w <= 0 || h <= 0 || bytes > MAX_BYTES) return undefined;
    if (old) this.remove(key, old);
    while (
      this.entries.size &&
      (this.entries.size >= MAX_ENTRIES || this.bytes + bytes > MAX_BYTES)
    ) {
      const oldest = this.entries.entries().next().value;
      if (oldest) this.remove(oldest[0], oldest[1]);
    }
    const image = document.createElement("canvas");
    image.width = w;
    image.height = h;
    const ctx = image.getContext("2d");
    if (!ctx) throw Error("Surface overlay unavailable");
    drawOverlayGeometry(
      ctx,
      items.map((d) => ({
        ...d,
        x: d.x - x,
        y: d.y - y,
        width: d.width - (d.kind === "line" ? x : 0),
        height: d.height - (d.kind === "line" ? y : 0),
      })),
      sheets,
    );
    touchRaster(image);
    this.entries.set(key, { image, items: items.map((d) => ({ ...d })), x, y });
    this.bytes += bytes;
    this.builds++;
    return { image, x, y };
  }
  private remove(key: string, entry: Entry) {
    this.releaseImage(entry.image);
    this.entries.delete(key);
    this.bytes -= entry.image.width * entry.image.height * 4;
  }
  clear() {
    for (const [key, entry] of this.entries) this.remove(key, entry);
  }
}

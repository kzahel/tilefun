import { rasterRevision } from "./RasterSurface.js";

/** Canvas equivalent of the GPU's screen-pixel filter. Scale nearest first, then
 * translate by a fraction of one output pixel. Transparent padding isolates crops.
 * Bounded by bytes and entries; animation/zoom never retain an unbounded history. */
export class SubpixelImages {
  private readonly ids = new WeakMap<object, number>();
  private nextId = 0;
  private readonly images = new Map<string, OffscreenCanvas>();
  bytes = 0;
  constructor(private readonly budget = 8 * 1024 * 1024) {}
  clear() {
    this.images.clear();
    this.bytes = 0;
  }
  get(
    image: CanvasImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    width: number,
    height: number,
  ) {
    const w = Math.max(1, Math.round(width)),
      h = Math.max(1, Math.round(height));
    let id = this.ids.get(image);
    if (id === undefined) {
      id = this.nextId++;
      this.ids.set(image, id);
    }
    const key = `${id}:${rasterRevision(image)}:${sx}:${sy}:${sw}:${sh}:${w}:${h}`;
    let raster = this.images.get(key);
    if (!raster) {
      raster = new OffscreenCanvas(w + 2, h + 2);
      const paint = raster.getContext("2d");
      if (!paint) throw Error("Subpixel sprite surface unavailable");
      paint.imageSmoothingEnabled = false;
      paint.drawImage(image, sx, sy, sw, sh, 1, 1, w, h);
      this.bytes += (w + 2) * (h + 2) * 4;
    } else this.images.delete(key);
    this.images.set(key, raster);
    while (this.images.size > 512 || (this.bytes > this.budget && this.images.size > 1)) {
      const first = this.images.entries().next().value;
      if (!first) break;
      this.images.delete(first[0]);
      this.bytes -= first[1].width * first[1].height * 4;
    }
    return raster;
  }
  draw(
    ctx: CanvasRenderingContext2D,
    image: CanvasImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    x: number,
    y: number,
    width: number,
    height: number,
    filtered = true,
  ) {
    const raster = this.get(image, sx, sy, sw, sh, width, height);
    const smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = filtered;
    ctx.drawImage(raster, x - 1, y - 1);
    ctx.imageSmoothingEnabled = smooth;
  }
}

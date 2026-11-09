import { RasterRenderBackend } from "./RasterRenderBackend.js";
import { SubpixelImages } from "./SubpixelImages.js";

/** Native Canvas2D raster for fingerprinted review images only (showcases, pattern
 * candidates). Their approval fingerprints hash these pixels, so they keep this raster
 * instead of the GPU (232). The game and labs draw only through WebGL2; nothing else
 * may use this class (see RenderingBoundary.test). Shared raster preparation and
 * placement live in the base. */
export class ReviewRasterBackend extends RasterRenderBackend {
  private readonly subpixel = new SubpixelImages();
  private readonly scaled = new SubpixelImages(64 * 1024 * 1024);
  constructor(...args: ConstructorParameters<typeof RasterRenderBackend>) {
    super(...args);
    this.ctx.drawSubpixelImage = (image, sx, sy, sw, sh, x, y, w, h) =>
      this.subpixel.draw(this.ctx as CanvasRenderingContext2D, image, sx, sy, sw, sh, x, y, w, h);
    this.ctx.drawStableImage = (image, sx, sy, sw, sh, x, y, w, h) => {
      if (Number.isInteger(w / sw) && Number.isInteger(h / sh))
        this.ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
      else
        this.scaled.draw(
          this.ctx as CanvasRenderingContext2D,
          image,
          sx,
          sy,
          sw,
          sh,
          x,
          y,
          w,
          h,
          false,
        );
    };
  }
  override clear() {
    this.subpixel.clear();
    this.scaled.clear();
    super.clear();
  }
  override invalidateAssets() {
    this.subpixel.clear();
    this.scaled.clear();
    super.invalidateAssets();
  }
  override getDiagnostics() {
    return {
      ...super.getDiagnostics(),
      actorRasterBytes: this.subpixel.bytes,
      scaledRasterBytes: this.scaled.bytes,
    };
  }
}

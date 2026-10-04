/**
 * Exact review pixels must use the same CPU raster path in headless-shell and
 * normal GPU-enabled browsers. Call before anything else acquires the context:
 * canvas context attributes are fixed by the first getContext call.
 */
const configured = new WeakSet<CanvasRenderingContext2D>();

export function reviewContext2D(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Review canvas unavailable");
  if (!configured.has(ctx)) {
    configured.add(ctx);
    const drawImage = ctx.drawImage.bind(ctx);
    ctx.drawImage = (image: CanvasImageSource, ...args: number[]) => {
      if (args.length !== 8 || args.some((value) => !Number.isFinite(value))) {
        // Whole-canvas copies keep the native path; source crops use the shader
        // below so translucent sprite pixels blend identically on ARM and x64.
        return Reflect.apply(drawImage, ctx, [image, ...args]);
      }
      const [sx, sy, sw, sh, dx, dy, dw, dh] = args as [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ];
      if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) {
        drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
        return;
      }
      // Skia's fast image blit rounds source-over differently by CPU architecture.
      // A pattern uses its raster shader instead, preserving the registered ARM
      // pixels without changing geometry, clipping, transforms or nearest sampling.
      const pattern = ctx.createPattern(image, "no-repeat");
      if (!pattern) throw new Error("Review image unavailable");
      pattern.setTransform(
        new DOMMatrix([dw / sw, 0, 0, dh / sh, dx - (sx * dw) / sw, dy - (sy * dh) / sh]),
      );
      ctx.save();
      ctx.fillStyle = pattern;
      ctx.fillRect(dx, dy, dw, dh);
      ctx.restore();
    };
  }
  return ctx;
}

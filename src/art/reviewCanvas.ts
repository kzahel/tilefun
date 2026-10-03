/**
 * Exact review pixels must use the same CPU raster path in headless-shell and
 * normal GPU-enabled browsers. Call before anything else acquires the context:
 * canvas context attributes are fixed by the first getContext call.
 */
export function reviewContext2D(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Review canvas unavailable");
  return ctx;
}

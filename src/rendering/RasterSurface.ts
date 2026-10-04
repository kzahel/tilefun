/** Drawing-side compatibility surface. Image resources stay behind RenderBackend;
 * this is not a presentation/world contract or a general Canvas emulation API.
 */
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
> & {
  pixelShadow?: (cx: number, cy: number, rx: number, ry: number) => void;
};

const revisions = new WeakMap<object, number>();
/** In-place raster preparation must publish a change even before completion. */
export function touchRaster(source: object): void {
  revisions.set(source, rasterRevision(source) + 1);
}
export function rasterRevision(source: object): number {
  return revisions.get(source) ?? 0;
}

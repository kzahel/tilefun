import type { Camera } from "./Camera.js";
import type { GpuShadow } from "./GpuShadowShape.js";
import type { DecalVertex } from "./ProjectedDecals.js";
import type { SpriteItem } from "./SceneItem.js";
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
  projectedDecal?: (
    image: CanvasImageSource,
    polygons: readonly (readonly DecalVertex[])[],
    depth: readonly [number, number, number],
    alpha: number,
    color: string,
  ) => void;
  setDepthPlane?: (a?: number, b?: number, c?: number) => void;
  drawStableImage?: NonNullable<RasterSurface["drawSubpixelImage"]>;
  drawSubpixelImage?: (
    image: CanvasImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => void;
  meshBody?: (camera: Camera, item: SpriteItem) => boolean;
  meshReady?: ReadonlySet<string>;
  pixelShadow?: (cx: number, cy: number, rx: number, ry: number) => void;
  /** Queue a caster for the GPU depth shadow pass (236); false when this pass
   * cannot run it (no world depth), and the caller draws a plain shadow. A
   * gated shadow is drawn only if that mesh body is drawn in the view (default:
   * the shadow's own `casterId`). */
  deferredShadow?: (camera: Camera, shadow: GpuShadow, gate?: number) => boolean;
  /** GPU-only scene fast paths (232); the native review raster draws through Canvas state. */
  fillShadow?: (x: number, y: number, rx: number, ry: number, smooth: boolean) => void;
  drawSpriteImage?: (
    image: CanvasImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
    flip: boolean,
    alpha: number | undefined,
    subpixel: boolean,
  ) => void;
};

const revisions = new WeakMap<object, number>();
/** In-place raster preparation must publish a change even before completion. */
export function touchRaster(source: object): void {
  revisions.set(source, rasterRevision(source) + 1);
}
export function rasterRevision(source: object): number {
  return revisions.get(source) ?? 0;
}

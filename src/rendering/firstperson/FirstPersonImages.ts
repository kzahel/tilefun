import * as THREE from "three";
import type { Spritesheet } from "../../assets/Spritesheet.js";
import type { Prop } from "../../entities/Prop.js";
import { type PropImageFrame, propImageFrame, propPieces } from "./FirstPersonProps.js";

/** A pixel rectangle: left, top, right, bottom. */
export type Rect = readonly [number, number, number, number];

export interface PropImage {
  /** The composed pixels: cards read them through the host's page atlas (250). */
  readonly image: HTMLCanvasElement;
  /** The same pixels as a texture of the view's own, for the faces of solid props. */
  readonly texture: THREE.Texture;
  /** Alpha-weighted average artwork colour (sRGB hex). */
  readonly color: number;
  readonly frame: PropImageFrame;
}

const MAX_PROP_IMAGES = 256;

/** Alpha of the average colour backing an opaque composition's empty pixels;
 * the artwork's own pixels are fully opaque. */
export const BACKING_ALPHA = 0xfe;

export function pixelTexture(source: TexImageSource): THREE.Texture {
  const texture = new THREE.Texture(source as THREE.Texture["image"]);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  // UVs count rows from the image top for canvases, images and bitmaps alike.
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Artwork the view composes from the already-decoded sprite sheets: one image
 * per prop or furniture piece, owned here (softly bounded). Opaque compositions
 * back transparent pixels with the average colour so a projected face never shows
 * holes. Sheet frames themselves are not copied: cards read them from the host's
 * page atlas.
 */
export class FirstPersonImages {
  private readonly propImages = new Map<string, PropImage>();
  /** Leftover compositions with nothing in them (`leftover`). */
  private readonly emptyLeftovers = new Set<string>();
  private disposed = false;

  /** `onEvict` lets the owner drop materials built on an evicted texture. */
  constructor(
    private readonly sheets: ReadonlyMap<string, Spritesheet>,
    private readonly onEvict: (texture: THREE.Texture) => void = () => {},
  ) {}

  sheet(key: string): Spritesheet | undefined {
    return this.disposed ? undefined : this.sheets.get(key);
  }

  prop(prop: Prop, opaque: boolean): PropImage | undefined {
    const pieces = propPieces(prop);
    const key = `${prop.sprite.sheetKey}|${opaque ? 1 : 0}|${pieces
      .map((p) => `${p.frameCol},${p.frameRow},${p.spriteWidth},${p.spriteHeight},${p.dx},${p.dy}`)
      .join(";")}`;
    const sheet = this.sheets.get(prop.sprite.sheetKey);
    if (!sheet && !this.propImages.has(key)) return undefined;
    const frame = propImageFrame(prop);
    return this.composed(key, frame, opaque, (ctx) => {
      if (!sheet) return;
      for (const p of pieces) {
        const region = sheet.getRegion(p.frameCol, p.frameRow);
        ctx.drawImage(
          sheet.image as CanvasImageSource,
          region.x,
          region.y,
          p.spriteWidth,
          p.spriteHeight,
          Math.round(p.dx - p.spriteWidth / 2 - frame.left),
          Math.round(p.dy - p.spriteHeight - frame.top),
          p.spriteWidth,
          p.spriteHeight,
        );
      }
    });
  }

  /**
   * A prop's artwork with `holes` (frame-local pixel rectangles: the silhouette
   * of its solid volumes, which wear the rest) cleared: what the volumes do not
   * show, such as rooftop signs and a carpet before the door. Null when nothing
   * is left; undefined while the sheet is not loaded.
   */
  leftover(prop: Prop, holes: readonly Rect[]): PropImage | null | undefined {
    const pieces = propPieces(prop);
    const key = `${prop.sprite.sheetKey}|left|${pieces
      .map((p) => `${p.frameCol},${p.frameRow},${p.spriteWidth},${p.spriteHeight},${p.dx},${p.dy}`)
      .join(";")}|${holes.map((h) => h.join(",")).join(";")}`;
    if (this.emptyLeftovers.has(key)) return null;
    const sheet = this.sheets.get(prop.sprite.sheetKey);
    if (!sheet && !this.propImages.has(key)) return undefined;
    const frame = propImageFrame(prop);
    let empty = false;
    const image = this.composed(key, frame, false, (ctx) => {
      if (!sheet) return;
      for (const p of pieces) {
        const region = sheet.getRegion(p.frameCol, p.frameRow);
        ctx.drawImage(
          sheet.image as CanvasImageSource,
          region.x,
          region.y,
          p.spriteWidth,
          p.spriteHeight,
          Math.round(p.dx - p.spriteWidth / 2 - frame.left),
          Math.round(p.dy - p.spriteHeight - frame.top),
          p.spriteWidth,
          p.spriteHeight,
        );
      }
      for (const [x0, y0, x1, y1] of holes) ctx.clearRect(x0, y0, x1 - x0, y1 - y0);
      const data = ctx.getImageData(0, 0, frame.width, frame.height).data;
      empty = true;
      for (let i = 3; i < data.length; i += 4)
        if ((data[i] ?? 0) >= 128) {
          empty = false;
          break;
        }
    });
    if (!empty) return image;
    // Nothing to draw: remember that, and give the canvas back.
    this.emptyLeftovers.add(key);
    const composed = this.propImages.get(key);
    composed?.texture.dispose();
    this.propImages.delete(key);
    return null;
  }

  /** One rectangle of a loaded sheet's image as artwork with the given frame (interior furniture). */
  region(
    sheetKey: string,
    rect: readonly [number, number, number, number],
    frame: PropImageFrame,
    opaque: boolean,
  ): PropImage | undefined {
    const key = `${sheetKey}|${opaque ? 1 : 0}|rect:${rect.join(",")}`;
    const sheet = this.sheets.get(sheetKey);
    if (!sheet && !this.propImages.has(key)) return undefined;
    const image = this.composed(key, frame, opaque, (ctx) => {
      if (sheet) ctx.drawImage(sheet.image as CanvasImageSource, ...rect, 0, 0, rect[2], rect[3]);
    });
    // Compositions are keyed by pixels; the caller's frame places them.
    return image && { ...image, frame };
  }

  /** Cached composition (least recently used out); `draw` paints it in frame-local pixels. */
  private composed(
    key: string,
    frame: PropImageFrame,
    opaque: boolean,
    draw: (ctx: CanvasRenderingContext2D) => void,
  ): PropImage | undefined {
    const cached = this.propImages.get(key);
    if (cached) {
      // Re-insert so eviction removes the least recently used composition.
      this.propImages.delete(key);
      this.propImages.set(key, cached);
      return cached;
    }
    if (this.disposed) return undefined;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, frame.width);
    canvas.height = Math.max(1, frame.height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return undefined;
    ctx.imageSmoothingEnabled = false;
    draw(ctx);
    const color = averageColor(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
    if (opaque) {
      // One step short of opaque: the top-down camera cuts the backing out again
      // (`ART_HOLES`), where the fixed view shows what lies behind.
      ctx.globalCompositeOperation = "destination-over";
      const hex = color.toString(16).padStart(6, "0");
      ctx.fillStyle = `#${hex}${BACKING_ALPHA.toString(16)}`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (this.propImages.size >= MAX_PROP_IMAGES) this.evictOldest();
    const image = { image: canvas, texture: pixelTexture(canvas), color, frame };
    this.propImages.set(key, image);
    return image;
  }

  /** Least recently used out. A chunk mesh that still draws the evicted texture keeps
   * it (Three uploads it again) until that chunk is released. */
  private evictOldest(): void {
    for (const [key, image] of this.propImages) {
      image.texture.dispose();
      this.onEvict(image.texture);
      this.propImages.delete(key);
      return;
    }
  }

  dispose(): void {
    this.disposed = true;
    for (const image of this.propImages.values()) image.texture.dispose();
    this.propImages.clear();
  }
}

/** Alpha-weighted average colour of a pixel rectangle (clamped to the image);
 * undefined when it holds no visible pixels. */
export function regionColor(
  image: { data: ArrayLike<number>; width: number; height: number },
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number | undefined {
  const left = Math.max(0, Math.floor(Math.min(x0, x1))),
    right = Math.min(image.width, Math.ceil(Math.max(x0, x1)));
  const top = Math.max(0, Math.floor(Math.min(y0, y1))),
    bottom = Math.min(image.height, Math.ceil(Math.max(y0, y1)));
  let r = 0,
    g = 0,
    b = 0,
    weight = 0;
  for (let y = top; y < bottom; y++)
    for (let x = left; x < right; x++) {
      const i = (y * image.width + x) * 4;
      const a = image.data[i + 3] ?? 0;
      if (a < 16) continue;
      r += (image.data[i] ?? 0) * a;
      g += (image.data[i + 1] ?? 0) * a;
      b += (image.data[i + 2] ?? 0) * a;
      weight += a;
    }
  if (!weight) return undefined;
  return (Math.round(r / weight) << 16) | (Math.round(g / weight) << 8) | Math.round(b / weight);
}

/** Alpha-weighted mean of RGBA bytes as an sRGB hex colour. */
export function averageColor(data: ArrayLike<number>): number {
  let r = 0,
    g = 0,
    b = 0,
    weight = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    const a = data[i + 3] ?? 0;
    if (a < 16) continue;
    r += (data[i] ?? 0) * a;
    g += (data[i + 1] ?? 0) * a;
    b += (data[i + 2] ?? 0) * a;
    weight += a;
  }
  if (!weight) return 0x8a8a8a;
  return (Math.round(r / weight) << 16) | (Math.round(g / weight) << 8) | Math.round(b / weight);
}

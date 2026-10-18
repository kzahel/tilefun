import type { Spritesheet } from "../assets/Spritesheet.js";
import type { Camera } from "./Camera.js";
import type { RasterSurface } from "./RasterSurface.js";
import type { SpriteItem } from "./SceneItem.js";

type Parts = NonNullable<SpriteItem["parts"]>;
interface Entry {
  sheet: Spritesheet;
  key: string;
  image: HTMLCanvasElement;
  x: number;
  y: number;
  used: number;
}

/** Backend-owned composites for stationary views. Crops retain their original
 * absolute destination coordinates in a bounded scratch surface before cropping:
 * Canvas nearest-neighbor texel ties can change if rasterized at a local origin.
 * Moving/unsnapped views use independent draws until the view settles, avoiding
 * cache churn. Parts are immutable sprite data; edits replace their array.
 */
export class StaticSpriteCache {
  private readonly entries = new Map<string, Entry>();
  private identities = new WeakMap<Parts, number>();
  private nextIdentity = 0;
  private frame = 0;
  private viewKey = "";
  private settled = false;
  private scratch: HTMLCanvasElement | undefined;
  private bytes = 0;
  private builds = 0;
  private hits = 0;
  static readonly MAX_BYTES = 16 * 1024 * 1024;
  static readonly MAX_ENTRIES = 128;

  beginFrame(camera: Camera) {
    this.frame++;
    const origin = camera.worldToScreen(0, 0);
    const key = `${origin.sx},${origin.sy},${camera.scale},${camera.viewportWidth},${camera.viewportHeight}`;
    this.settled = key === this.viewKey;
    this.viewKey = key;
    for (const [key, entry] of this.entries) if (this.frame - entry.used > 120) this.remove(key);
    if (!this.entries.size) this.scratch = undefined;
  }

  private remove(key: string) {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.bytes -= entry.image.width * entry.image.height * 4;
    this.entries.delete(key);
  }

  draw(ctx: RasterSurface, camera: Camera, item: SpriteItem, sheet: Spritesheet): boolean {
    const parts = item.parts;
    if (
      !parts ||
      parts.length < 32 ||
      !camera.pixelSnap ||
      !this.settled ||
      item.alpha !== undefined ||
      item.flipX ||
      camera.viewportWidth > 2048 ||
      camera.viewportHeight > 2048
    )
      return false;
    const bottom = item.wy - item.zOffset + item.drawOffsetY;
    const anchor = camera.worldToScreen(item.wx, bottom);
    const x = Math.floor(anchor.sx),
      y = Math.floor(anchor.sy);
    let identity = this.identities.get(parts);
    if (identity === undefined) {
      identity = ++this.nextIdentity;
      this.identities.set(parts, identity);
    }
    // Repeated buildings/trees can share one immutable recipe array at many
    // positions; retain each placement instead of rebuilding it every frame.
    const key = `${identity},${this.viewKey},${item.wx},${bottom}`;
    let entry = this.entries.get(key);
    if (entry?.key !== key || entry.sheet !== sheet) {
      if (entry) this.remove(key);
      const draws = parts.map((p) => {
        const a = camera.worldToScreen(
          item.wx + p.dx - p.spriteWidth / 2,
          bottom + p.dy - p.spriteHeight,
        );
        const b = camera.worldToScreen(item.wx + p.dx + p.spriteWidth / 2, bottom + p.dy);
        return {
          p,
          x: Math.floor(a.sx),
          y: Math.floor(a.sy),
          w: Math.floor(b.sx) - Math.floor(a.sx),
          h: Math.floor(b.sy) - Math.floor(a.sy),
        };
      });
      const left = Math.max(0, Math.min(...draws.map((d) => d.x))),
        top = Math.max(0, Math.min(...draws.map((d) => d.y)));
      const width = Math.min(camera.viewportWidth, Math.max(...draws.map((d) => d.x + d.w))) - left;
      const height =
        Math.min(camera.viewportHeight, Math.max(...draws.map((d) => d.y + d.h))) - top;
      const bytes = width * height * 4;
      if (
        width <= 0 ||
        height <= 0 ||
        width > 2048 ||
        height > 2048 ||
        bytes + camera.viewportWidth * camera.viewportHeight * 4 > StaticSpriteCache.MAX_BYTES
      )
        return false;
      const image = document.createElement("canvas");
      image.width = width;
      image.height = height;
      const raster = image.getContext("2d");
      if (!raster) return false;
      this.scratch ??= document.createElement("canvas");
      if (this.scratch.width !== camera.viewportWidth) this.scratch.width = camera.viewportWidth;
      if (this.scratch.height !== camera.viewportHeight)
        this.scratch.height = camera.viewportHeight;
      const scratch = this.scratch.getContext("2d");
      if (!scratch) return false;
      scratch.clearRect(0, 0, this.scratch.width, this.scratch.height);
      scratch.imageSmoothingEnabled = false;
      raster.imageSmoothingEnabled = false;
      for (const d of draws) {
        const region = sheet.getRegion(d.p.frameCol, d.p.frameRow);
        scratch.drawImage(
          sheet.image,
          region.x,
          region.y,
          d.p.spriteWidth,
          d.p.spriteHeight,
          d.x,
          d.y,
          d.w,
          d.h,
        );
      }
      raster.drawImage(this.scratch, left, top, width, height, 0, 0, width, height);
      while (
        this.entries.size >= StaticSpriteCache.MAX_ENTRIES ||
        this.bytes + bytes + this.scratch.width * this.scratch.height * 4 >
          StaticSpriteCache.MAX_BYTES
      ) {
        const oldest = this.entries.keys().next().value;
        if (!oldest) break;
        this.remove(oldest);
      }
      entry = { sheet, key, image, x: left - x, y: top - y, used: this.frame };
      this.entries.set(key, entry);
      this.bytes += bytes;
      this.builds++;
    } else {
      this.hits++;
      // Map order is LRU order, bounded independently of the world/viewport.
      this.entries.delete(key);
      this.entries.set(key, entry);
    }
    entry.used = this.frame;
    ctx.drawImage(entry.image, x + entry.x, y + entry.y);
    return true;
  }

  getDiagnostics() {
    return {
      resident: this.entries.size,
      bytes: this.bytes + (this.scratch ? this.scratch.width * this.scratch.height * 4 : 0),
      builds: this.builds,
      hits: this.hits,
    };
  }

  clear() {
    this.entries.clear();
    this.identities = new WeakMap();
    this.nextIdentity = 0;
    this.bytes = 0;
    this.scratch = undefined;
    this.viewKey = "";
    this.settled = false;
  }
}

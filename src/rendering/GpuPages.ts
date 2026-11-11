import * as THREE from "three";
import type { AtlasRegion } from "./AtlasAllocator.js";
import { ATLAS_PAGE, GpuPageAtlas } from "./GpuPageAtlas.js";
import { rasterRevision } from "./RasterSurface.js";

/** Largest page edge; images are split into pages of at most this size. A page
 * uploads whole the first time a sprite in it is drawn: at 512 that is at most
 * 1 MiB, where a 1,024 page of a large sheet (4 MiB) cost a phone a frame. */
export const PAGE = 512;
export interface Page {
  image: CanvasImageSource;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Atlas layer region, or a separate texture once the atlas is at its cap. */
  region: AtlasRegion | null;
  /** The region in layer UVs ([minU, minV, maxU, maxV]); null for a separate texture. */
  bounds: readonly number[] | null;
  texture: THREE.Texture | null;
  source: HTMLCanvasElement;
  revision: number;
  used: number;
}
export interface PageStats {
  uploads: number;
  uploadedBytes: number;
  textureBytes: number;
  textures: number;
  atlasLayers: number;
  atlasBytes: number;
  atlasMisses: number;
  /** Reused upload textures, outside `textureBytes` and `atlasBytes`. */
  stagingBytes: number;
}
export const size = (image: CanvasImageSource) => {
  const source = image as HTMLImageElement;
  return {
    width: Number(source.naturalWidth || source.width),
    height: Number(source.naturalHeight || source.height),
  };
};

/** Resident GPU copies of raster sources, split into pages of at most PAGE
 * texels, kept in the page atlas (232) with an LRU of age and byte budget. */
export class GpuPages {
  /** Read (with `get`/`remove`) by scripts/streaming-profile.mjs and city-audit. */
  readonly pages = new Map<CanvasImageSource, Page[]>();
  readonly atlas: GpuPageAtlas;
  /** Diagnostic A/B: false keeps every page in its own texture (pre-232 batching). */
  atlasEnabled = true;
  private frame = 0;
  // Decoded images cannot change asynchronously during synchronous submission.
  // Read their DOM dimensions once per frame, retaining only weak source keys.
  // Dynamic canvas sources continue through size() on every call.
  private imageSizes = new WeakMap<
    HTMLImageElement | ImageBitmap,
    { frame: number; width: number; height: number }
  >();

  constructor(
    renderer: THREE.WebGLRenderer,
    private readonly stats: PageStats,
    /** Drains queued quads before a page they may sample changes. */
    private readonly flush: () => void,
  ) {
    this.atlas = new GpuPageAtlas(renderer);
  }
  /** LRU with an age limit and a byte budget. Current-frame pages are never
   * retired mid-command; excess residency is collected next frame. */
  beginFrame() {
    this.frame++;
    const cold: Page[] = [];
    for (const pages of this.pages.values()) for (const page of pages) cold.push(page);
    cold.sort((a, b) => a.used - b.used);
    for (const page of cold) {
      if (this.frame - page.used < 2) continue;
      if (this.frame - page.used <= 120 && this.stats.textureBytes <= 64 * 1024 * 1024) continue;
      this.remove(page);
    }
    this.atlas.compact();
    this.updateStats();
  }
  private updateStats() {
    this.stats.atlasLayers = this.atlas.layers;
    this.stats.atlasBytes = this.atlas.bytes;
    this.stats.stagingBytes = this.atlas.stagingBytes;
  }
  imageSize(image: CanvasImageSource): { width: number; height: number } {
    if (!(image instanceof ImageBitmap || image instanceof HTMLImageElement)) return size(image);
    let cached = this.imageSizes.get(image);
    if (!cached) {
      cached = { frame: this.frame, ...size(image) };
      this.imageSizes.set(image, cached);
    } else if (cached.frame !== this.frame) {
      const current = size(image);
      cached.width = current.width;
      cached.height = current.height;
      cached.frame = this.frame;
    }
    return cached;
  }
  get(image: CanvasImageSource, x: number, y: number, dim: { width: number; height: number }) {
    let pages = this.pages.get(image);
    if (!pages) {
      pages = [];
      this.pages.set(image, pages);
    }
    let page = pages.find((p) => p.x === x && p.y === y);
    if (!page) {
      page = this.create(image, x, y, dim);
      pages.push(page);
    }
    const revision = rasterRevision(image);
    if (page.revision !== revision) {
      // A new page's storage is unused by queued quads; a changed one is not.
      if (page.revision !== -1) this.flush();
      const ctx = page.source.getContext("2d");
      if (!ctx) throw Error("Texture page unavailable");
      ctx.clearRect(0, 0, page.width, page.height);
      ctx.drawImage(image, x, y, page.width, page.height, 0, 0, page.width, page.height);
      if (page.region) this.atlas.write(page.source, page.region);
      else if (page.texture) page.texture.needsUpdate = true;
      this.updateStats();
      page.revision = revision;
      this.stats.uploads++;
      this.stats.uploadedBytes += page.width * page.height * 4;
    }
    page.used = this.frame;
    return page;
  }
  private create(
    image: CanvasImageSource,
    x: number,
    y: number,
    dim: { width: number; height: number },
  ) {
    const source = document.createElement("canvas");
    source.width = Math.min(PAGE, dim.width - x);
    source.height = Math.min(PAGE, dim.height - y);
    // A CPU canvas: its pixels upload directly, without work in the GPU process to
    // rasterize the copy first.
    source.getContext("2d", { willReadFrequently: true });
    const region = this.atlasEnabled ? this.atlas.allocate(source.width, source.height) : null;
    let texture: THREE.Texture | null = null;
    if (!region) {
      if (this.atlasEnabled) this.stats.atlasMisses++;
      texture = new THREE.Texture(source);
      texture.magFilter = texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
    }
    this.stats.textureBytes += source.width * source.height * 4;
    this.stats.textures++;
    const { width, height } = source;
    const bounds = region && [
      region.x / ATLAS_PAGE,
      region.y / ATLAS_PAGE,
      (region.x + width) / ATLAS_PAGE,
      (region.y + height) / ATLAS_PAGE,
    ];
    const used = this.frame;
    return { image, x, y, width, height, region, bounds, texture, source, revision: -1, used };
  }
  private remove(page: Page) {
    page.texture?.dispose();
    if (page.region) this.atlas.free(page.region);
    this.stats.textureBytes -= page.width * page.height * 4;
    this.stats.textures--;
    const list = this.pages.get(page.image);
    if (list) {
      list.splice(list.indexOf(page), 1);
      if (!list.length) this.pages.delete(page.image);
    }
  }
  /** Retire a backend-owned source only after its queued quads are consumed. */
  release(image: CanvasImageSource) {
    const pages = this.pages.get(image);
    if (!pages) return;
    this.flush();
    for (const page of [...pages]) this.remove(page);
  }
  clear() {
    for (const pages of this.pages.values()) for (const p of pages) p.texture?.dispose();
    this.pages.clear();
    this.atlas.clear();
    this.imageSizes = new WeakMap();
    this.stats.textureBytes = 0;
    this.stats.textures = 0;
    this.updateStats();
  }
}

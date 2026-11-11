import * as THREE from "three";
import { AtlasAllocator, type AtlasRegion } from "./AtlasAllocator.js";

/** Layer edge; the surface's pages are at most this size, so each fits one layer. */
export const ATLAS_PAGE = 1024;
const LAYER_BYTES = ATLAS_PAGE * ATLAS_PAGE * 4;
/** Staging textures are reused per page size, least recently used first out. */
const STAGING_BYTES = 8 * 1024 * 1024;

/**
 * Paged raster images (sprite sheets, terrain chunks, shadow ellipses, overlays)
 * share one TEXTURE_2D_ARRAY, so interleaved sources no longer split batches at
 * the sampler-slot limit (232). The array grows by half when full (GPU copy of
 * the old layers) and halves once eviction empties its top three quarters. A
 * resize holds the old and new arrays until its copy completes, so the transient
 * peak is up to 2.5× the old array (cap 256 MiB: ~416 MiB for one frame).
 *
 * Pages upload into a 2D staging texture (the browser's fast canvas path; array
 * uploads from canvases read back through the CPU) and copy into their layer on
 * the GPU. Staging flips rows like the 2D pages did, so layers hold each page
 * bottom row first and nearest lookups match the 2D page textures; the shader
 * clamps unfiltered lookups to the page region, as CLAMP_TO_EDGE did.
 */
export class GpuPageAtlas {
  private target: THREE.WebGLArrayRenderTarget | null = null;
  private allocator = new AtlasAllocator(ATLAS_PAGE);
  private readonly deviceLayers: number;
  maxLayers: number;
  /** Reused per page size; never drawn. */
  private readonly staging = new Map<string, THREE.Texture>();
  stagingBytes = 0;
  /** Read framebuffer for page copies; lost and remade with the context. */
  private copyFramebuffer: WebGLFramebuffer | null = null;
  resizes = 0;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    maxBytes = 256 * 1024 * 1024,
  ) {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    this.deviceLayers = Number(gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS)) || 0;
    this.maxLayers = Math.min(this.deviceLayers, Math.floor(maxBytes / LAYER_BYTES));
  }
  /** Diagnostic: a lower cap exercises growth, shrinking and the fallback. Applies to
   * later growth; call on an empty atlas. */
  limitLayers(layers: number) {
    this.maxLayers = Math.max(0, Math.min(this.deviceLayers, Math.floor(layers)));
  }
  get texture(): THREE.Texture | null {
    return this.target?.texture ?? null;
  }
  get layers() {
    return this.allocator.layers;
  }
  get bytes() {
    return this.allocator.layers * LAYER_BYTES;
  }
  /** Null when the array is at its cap; the caller keeps a separate texture. */
  allocate(width: number, height: number): AtlasRegion | null {
    // Never grow for a page no layer can hold.
    if (!(width >= 1 && height >= 1 && width <= ATLAS_PAGE && height <= ATLAS_PAGE)) return null;
    let region = this.allocator.allocate(width, height);
    while (!region && this.allocator.layers < this.maxLayers) {
      const layers = this.allocator.layers;
      this.resize(Math.min(this.maxLayers, layers + Math.max(1, Math.ceil(layers / 2))));
      region = this.allocator.allocate(width, height);
    }
    return region;
  }
  free(region: AtlasRegion) {
    this.allocator.free(region);
  }
  /** Upload `page` (the region's size) into its layer region. */
  write(page: HTMLCanvasElement, region: AtlasRegion) {
    const target = this.target;
    if (!target) throw Error("Atlas region without storage");
    const staging = this.stagingFor(page);
    staging.image = page;
    staging.needsUpdate = true;
    this.renderer.initTexture(staging);
    // Copy on the GPU with plain GL. The renderer's own texture copy first reads
    // five pixel-store parameters back from the context; each read waits for the
    // GPU process to finish the upload above, which stalls a phone for 20–40 ms.
    const { renderer } = this,
      gl = renderer.getContext() as WebGL2RenderingContext;
    const glTexture = (texture: THREE.Texture) =>
      (renderer.properties.get(texture) as { __webglTexture: WebGLTexture }).__webglTexture;
    this.copyFramebuffer ??= gl.createFramebuffer();
    renderer.state.bindFramebuffer(gl.READ_FRAMEBUFFER, this.copyFramebuffer);
    gl.framebufferTexture2D(
      gl.READ_FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      glTexture(staging),
      0,
    );
    renderer.state.activeTexture(gl.TEXTURE0);
    renderer.state.bindTexture(gl.TEXTURE_2D_ARRAY, glTexture(target.texture));
    gl.copyTexSubImage3D(
      gl.TEXTURE_2D_ARRAY,
      0,
      region.x,
      region.y,
      region.layer,
      0,
      0,
      region.width,
      region.height,
    );
    // Unbind both, so restoring the caller's target rebinds read and draw alike.
    renderer.state.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    renderer.state.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    this.restoreTarget();
  }
  private stagingFor(page: HTMLCanvasElement) {
    const key = `${page.width}x${page.height}`;
    let staging = this.staging.get(key);
    if (staging) this.staging.delete(key);
    else {
      staging = new THREE.Texture(page);
      staging.magFilter = staging.minFilter = THREE.NearestFilter;
      staging.generateMipmaps = false;
      this.stagingBytes += page.width * page.height * 4;
    }
    this.staging.set(key, staging);
    for (const [oldKey, texture] of this.staging) {
      if (this.stagingBytes <= STAGING_BYTES || texture === staging) break;
      const image = texture.image as HTMLCanvasElement;
      this.stagingBytes -= image.width * image.height * 4;
      texture.dispose();
      this.staging.delete(oldKey);
    }
    return staging;
  }
  /** GPU copies leave framebuffers bound; draw on into the caller's target. */
  private restoreTarget() {
    this.renderer.setRenderTarget(this.renderer.getRenderTarget());
  }
  /** Halve once the top three quarters are empty; call between batches. */
  compact() {
    const layers = this.allocator.layers;
    if (layers > 1 && this.allocator.highestUsedLayer() < layers / 4)
      this.resize(Math.ceil(layers / 2));
  }
  private resize(layers: number) {
    const next = new THREE.WebGLArrayRenderTarget(ATLAS_PAGE, ATLAS_PAGE, layers, {
      depthBuffer: false,
      magFilter: THREE.NearestFilter,
      minFilter: THREE.NearestFilter,
      generateMipmaps: false,
    });
    this.renderer.initRenderTarget(next);
    const old = this.target,
      keep = Math.min(old?.depth ?? 0, layers);
    if (old && keep)
      this.renderer.copyTextureToTexture(
        old.texture,
        next.texture,
        new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(ATLAS_PAGE, ATLAS_PAGE, keep)),
        new THREE.Vector3(0, 0, 0),
      );
    old?.dispose();
    this.restoreTarget();
    this.target = next;
    this.allocator.resize(layers);
    this.resizes++;
  }
  /** Forget every region; context recovery and asset changes rebuild pages. */
  clear() {
    for (const texture of this.staging.values()) texture.dispose();
    this.staging.clear();
    this.stagingBytes = 0;
    this.target?.dispose();
    this.target = null;
    this.copyFramebuffer = null;
    this.allocator = new AtlasAllocator(ATLAS_PAGE);
  }
}

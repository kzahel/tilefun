import * as THREE from "three";
import { AtlasAllocator, type AtlasRegion } from "./AtlasAllocator.js";

/** Layer edge; the surface's pages are at most this size, so each fits one layer. */
export const ATLAS_PAGE = 1024;
const LAYER_BYTES = ATLAS_PAGE * ATLAS_PAGE * 4;
/** Staging textures are reused per page size, least recently used first out. */
const STAGING_BYTES = 8 * 1024 * 1024;

/** A triangle over the whole target that writes one layer's texels as they are. */
function layerCopier() {
  const uniforms = { atlas: { value: null as THREE.Texture | null }, layer: { value: 0 } };
  const material = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms,
    vertexShader: "in vec3 position;\nvoid main() { gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: `precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray atlas;
uniform int layer;
out vec4 texel;
void main() { texel = texelFetch(atlas, ivec3(ivec2(gl_FragCoord.xy), layer), 0); }`,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
  );
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  return { scene, camera: new THREE.Camera(), uniforms, material, geometry };
}

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
  /** Draws a layer of one atlas into another when the array grows or shrinks. */
  private copier: ReturnType<typeof layerCopier> | null = null;
  resizes = 0;
  /** A headset session is using the context (252), as a screen or immersively:
   * growth then draws the old layers; see `drawLayers`. */
  session = false;

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
    if (old && keep) {
      if (this.session) {
        const drawing = this.renderer.getRenderTarget();
        this.drawLayers(old.texture, next, keep);
        this.renderer.setRenderTarget(drawing);
      } else
        this.renderer.copyTextureToTexture(
          old.texture,
          next.texture,
          new THREE.Box3(
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(ATLAS_PAGE, ATLAS_PAGE, keep),
          ),
          new THREE.Vector3(0, 0, 0),
        );
    }
    old?.dispose();
    this.restoreTarget();
    this.target = next;
    this.allocator.resize(layers);
    this.resizes++;
  }
  /**
   * Draw the first `layers` layers of one atlas texture into another's: the
   * copy used while a headset session lasts (252).
   *
   * On a Quest 3 inside a session, every framebuffer copy (`copyTexSubImage3D`,
   * `blitFramebuffer`, the renderer's texture copy) read the atlas without the
   * pages written since the session began, while sampling it returned them all.
   * Outside a session the renderer's copy stays as it was: it has not been seen
   * to fail there, and the fixed view's path is left unchanged.
   */
  private drawLayers(from: THREE.Texture, to: THREE.WebGLArrayRenderTarget, layers: number) {
    const { renderer } = this;
    this.copier ??= layerCopier();
    const { scene, camera, uniforms } = this.copier;
    // A headset's eyes replace the camera of every render while its output is on.
    const { xr } = renderer;
    const headset = xr.enabled;
    xr.enabled = false;
    uniforms.atlas.value = from;
    try {
      for (let layer = 0; layer < layers; layer++) {
        uniforms.layer.value = layer;
        renderer.setRenderTarget(to, layer);
        renderer.render(scene, camera);
      }
    } finally {
      uniforms.atlas.value = null;
      xr.enabled = headset;
    }
  }
  /** Forget every region; context recovery and asset changes rebuild pages. */
  clear() {
    for (const texture of this.staging.values()) texture.dispose();
    this.staging.clear();
    this.stagingBytes = 0;
    this.target?.dispose();
    this.target = null;
    this.copyFramebuffer = null;
    this.copier?.material.dispose();
    this.copier?.geometry.dispose();
    this.copier = null;
    this.allocator = new AtlasAllocator(ATLAS_PAGE);
  }
}

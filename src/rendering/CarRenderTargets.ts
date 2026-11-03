import * as THREE from "three";

interface Targets {
  source: THREE.WebGLRenderTarget;
  outline: THREE.WebGLRenderTarget;
  frame: number;
}
/** Exact native-size scratch pairs. Changing moving-car sizes must not recreate
 * color/depth textures and framebuffers every draw. Composites still flush before
 * a scratch image is overwritten; this is allocation reuse, not pose reuse. */
export class CarRenderTargets {
  private readonly entries = new Map<number, Targets>();
  private frame = 0;
  bytes = 0;
  creates = 0;
  hits = 0;
  evictions = 0;
  constructor(
    private readonly maxBytes = 16 * 1024 * 1024,
    private readonly maxEntries = 16,
  ) {}
  beginFrame() {
    this.frame++;
    for (const [size, pair] of this.entries) if (this.frame - pair.frame > 120) this.remove(size);
  }
  get(size: number): Targets {
    const bytes = size * size * 16; // Two RGBA8 + unsigned-int depth targets.
    if (!Number.isSafeInteger(size) || size < 1 || size > 1024 || bytes > this.maxBytes)
      throw Error("Vehicle scratch target exceeds its budget");
    const old = this.entries.get(size);
    if (old) {
      this.hits++;
      old.frame = this.frame;
      this.entries.delete(size);
      this.entries.set(size, old);
      return old;
    }
    while (
      this.entries.size &&
      (this.bytes + bytes > this.maxBytes || this.entries.size >= this.maxEntries)
    ) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.remove(oldest);
    }
    const create = () => {
      const target = new THREE.WebGLRenderTarget(size, size, { depthBuffer: true });
      target.depthTexture = new THREE.DepthTexture(size, size, THREE.UnsignedIntType);
      target.texture.colorSpace = THREE.SRGBColorSpace;
      target.texture.magFilter = target.texture.minFilter = THREE.NearestFilter;
      target.texture.generateMipmaps = false;
      return target;
    };
    const pair = { source: create(), outline: create(), frame: this.frame };
    this.entries.set(size, pair);
    this.bytes += bytes;
    this.creates++;
    return pair;
  }
  private remove(size: number) {
    const pair = this.entries.get(size);
    if (!pair) return;
    pair.source.dispose();
    pair.outline.dispose();
    this.entries.delete(size);
    this.bytes -= size * size * 16;
    this.evictions++;
  }
  clear() {
    for (const size of this.entries.keys()) this.remove(size);
  }
  get diagnostics() {
    return {
      pairs: this.entries.size,
      bytes: this.bytes,
      creates: this.creates,
      hits: this.hits,
      evictions: this.evictions,
    };
  }
}

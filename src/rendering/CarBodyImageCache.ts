import * as THREE from "three";
import type { MeshInstance } from "./MeshPresentation.js";

/** Exact local image inputs. World position, camera and composite alpha are external. */
export function carBodyImageKey(
  mesh: MeshInstance,
  assetGeneration: number,
  paint?: THREE.Texture,
) {
  return JSON.stringify([
    mesh.assetId,
    assetGeneration,
    paint?.id ?? null,
    paint?.version ?? 0,
    mesh.radius,
    ...mesh.orientation,
    mesh.gradePitch ?? 0,
    mesh.gradeRoll ?? 0,
    mesh.gradeOffsetZ ?? 0,
    mesh.wheelTravel ?? 0,
    mesh.bedTilt ?? 0,
    mesh.bedGateAngle ?? 0,
    mesh.towActive ?? false,
    mesh.towPitch ?? 0,
    mesh.towOffsetX ?? 0,
    mesh.towOffsetZ ?? 0,
  ]);
}

/** Finished native-pixel images; changing poses must recur across frames before admission. */
export class CarBodyImageCache {
  private readonly entries = new Map<string, { target: THREE.WebGLRenderTarget; frame: number }>();
  private previous = new Set<string>();
  private seen = new Set<string>();
  private frame = 0;
  bytes = 0;
  hits = 0;
  misses = 0;
  enabled = true;
  constructor(
    private readonly maxBytes = 16 * 1024 * 1024,
    private readonly maxEntries = 64,
  ) {}
  beginFrame() {
    this.frame++;
    this.previous = this.seen;
    this.seen = new Set();
    for (const [key, entry] of this.entries) if (this.frame - entry.frame > 120) this.remove(key);
  }
  get(key: string) {
    if (!this.enabled) return undefined;
    if (this.seen.size < 512) this.seen.add(key);
    const entry = this.entries.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    entry.frame = this.frame;
    this.entries.delete(key);
    this.entries.set(key, entry);
    this.hits++;
    return entry.target.texture;
  }
  /** Caller renders directly into this target, avoiding a copy/readback. */
  admit(key: string, size: number) {
    const bytes = size * size * 4;
    if (!this.enabled || !this.previous.has(key) || bytes > this.maxBytes) return undefined;
    while (
      this.entries.size &&
      (this.bytes + bytes > this.maxBytes || this.entries.size >= this.maxEntries)
    ) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.remove(oldest);
    }
    const target = new THREE.WebGLRenderTarget(size, size, { depthBuffer: false });
    target.texture.colorSpace = THREE.SRGBColorSpace;
    target.texture.magFilter = target.texture.minFilter = THREE.NearestFilter;
    target.texture.generateMipmaps = false;
    this.entries.set(key, { target, frame: this.frame });
    this.bytes += bytes;
    return target;
  }
  private remove(key: string) {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.bytes -= entry.target.width * entry.target.height * 4;
    entry.target.dispose();
    this.entries.delete(key);
  }
  clear() {
    for (const key of this.entries.keys()) this.remove(key);
    this.previous.clear();
    this.seen.clear();
  }
  get size() {
    return this.entries.size;
  }
}

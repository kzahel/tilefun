import type * as THREE from "three";
import { carImageTarget } from "./CarRenderTargets.js";
import { FrameCarImages } from "./FrameCarImages.js";
import type { MeshInstance } from "./MeshPresentation.js";

/** Exact local image inputs. World position, camera and composite alpha are external. */
export function carBodyImageKey(
  mesh: MeshInstance,
  assetGeneration: number,
  paint?: THREE.Texture,
) {
  return JSON.stringify([
    mesh.assetId,
    mesh.physical ?? false,
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

/** Finished native-pixel images; changing poses must recur across frames before admission.
 * With several views, a pose not admitted is kept for the rest of its display frame
 * (`FrameCarImages`), so later views reuse it. */
export class CarBodyImageCache {
  private readonly entries = new Map<string, { target: THREE.WebGLRenderTarget; frame: number }>();
  readonly frameImages = new FrameCarImages();
  private previous = new Set<string>();
  private seen = new Set<string>();
  private frame = 0;
  bytes = 0;
  hits = 0;
  misses = 0;
  frameHits = 0;
  enabled = true;
  constructor(
    private readonly maxBytes = 16 * 1024 * 1024,
    private readonly maxEntries = 64,
  ) {}
  /** `views`: how many views the last display frame drew (the layout, known before drawing). */
  beginFrame(views = 1) {
    this.frame++;
    this.previous = this.seen;
    this.seen = new Set();
    for (const [key, entry] of this.entries) if (this.frame - entry.frame > 120) this.remove(key);
    this.frameImages.beginFrame(this.enabled && views > 1);
  }
  get(key: string) {
    if (!this.enabled) return undefined;
    if (this.seen.size < 512) this.seen.add(key);
    const entry = this.entries.get(key);
    if (!entry) {
      const drawn = this.frameImages.get(key);
      if (drawn) {
        this.frameHits++;
        return drawn.texture;
      }
      this.misses++;
      return undefined;
    }
    entry.frame = this.frame;
    this.entries.delete(key);
    this.entries.set(key, entry);
    this.hits++;
    return entry.target.texture;
  }
  depth(key: string) {
    return (this.entries.get(key)?.target ?? this.frameImages.get(key))?.depthTexture;
  }
  /** Caller renders directly into this target, avoiding a copy/readback. A pose that
   * did not recur gets this frame's target when several views draw. */
  admit(key: string, size: number) {
    const bytes = size * size * 8;
    if (!this.enabled || bytes > this.maxBytes) return undefined;
    if (!this.previous.has(key)) return this.frameImages.take(key, size);
    while (
      this.entries.size &&
      (this.bytes + bytes > this.maxBytes || this.entries.size >= this.maxEntries)
    ) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.remove(oldest);
    }
    const target = carImageTarget(size);
    this.entries.set(key, { target, frame: this.frame });
    this.bytes += bytes;
    return target;
  }
  private remove(key: string) {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.bytes -= entry.target.width * entry.target.height * 8;
    entry.target.dispose();
    this.entries.delete(key);
  }
  clear() {
    for (const key of this.entries.keys()) this.remove(key);
    this.frameImages.clear();
    this.previous.clear();
    this.seen.clear();
  }
  get size() {
    return this.entries.size;
  }
}

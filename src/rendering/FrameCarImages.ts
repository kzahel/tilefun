import type * as THREE from "three";
import { carImageTarget } from "./CarRenderTargets.js";

interface Sized {
  readonly targets: THREE.WebGLRenderTarget[];
  used: number;
  frame: number;
}

/**
 * The same-frame car image memo (226): with several views, a moving car's image
 * drawn by an earlier view of a display frame is reused by the later views
 * instead of being rendered again. Images last until the next display frame.
 * Targets are pooled by size across frames, so a moving fleet allocates no
 * framebuffers once warm; a size unused for 120 frames is released.
 */
export class FrameCarImages {
  private readonly pool = new Map<number, Sized>();
  private readonly images = new Map<string, THREE.WebGLRenderTarget>();
  private frame = 0;
  private active = false;
  bytes = 0;
  constructor(private readonly maxBytes = 8 * 1024 * 1024) {}
  /** Inactive (one view) takes nothing, so a single view renders exactly as before. */
  beginFrame(active: boolean) {
    this.frame++;
    this.active = active;
    this.images.clear();
    for (const [size, sized] of this.pool) {
      sized.used = 0;
      if (this.frame - sized.frame > 120) this.drop(size);
    }
  }
  get(key: string) {
    return this.images.get(key);
  }
  /** A target for this frame's image of `key`, or undefined when inactive or over budget. */
  take(key: string, size: number) {
    if (!this.active) return undefined;
    const sized = this.pool.get(size) ?? { targets: [], used: 0, frame: this.frame };
    let target = sized.targets[sized.used];
    if (!target) {
      const bytes = size * size * 8;
      if (this.bytes + bytes > this.maxBytes) return undefined;
      target = carImageTarget(size);
      sized.targets.push(target);
      this.pool.set(size, sized);
      this.bytes += bytes;
    }
    sized.used++;
    sized.frame = this.frame;
    this.images.set(key, target);
    return target;
  }
  private drop(size: number) {
    const sized = this.pool.get(size);
    if (!sized) return;
    for (const target of sized.targets) target.dispose();
    this.bytes -= sized.targets.length * size * size * 8;
    this.pool.delete(size);
  }
  clear() {
    for (const size of [...this.pool.keys()]) this.drop(size);
    this.images.clear();
  }
}

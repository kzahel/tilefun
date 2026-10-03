import type { InteriorPresentation } from "../interiors/InteriorPresentation.js";
import { GrassFrameBuffer } from "./GrassFrameBuffer.js";
import { OverlayFrame } from "./OverlayFrame.js";
import { PropDepthCache } from "./propDepth.js";
import type { SceneItem } from "./SceneItem.js";

/** One client's synchronous presentation storage, independent of the backend.
 * The list and pooled grass records are borrowed until the next collection.
 * Prop depth metadata stays resident only for the latest collected props.
 * Release after drawing so particles and elevation surfaces are not retained.
 */
export class SceneFrame {
  interior: InteriorPresentation | null = null;
  interiorKey = "";
  readonly overlays = new OverlayFrame();
  readonly drawOrder: number[] = [];
  readonly items: SceneItem[] = [];
  readonly grass = new GrassFrameBuffer();
  readonly propDepth = new PropDepthCache();

  begin(hasGrass: boolean): SceneItem[] {
    this.release();
    if (!hasGrass) this.grass.clear();
    return this.items;
  }

  release(): void {
    this.interior?.release();
    this.overlays.release();
    this.items.length = 0;
    this.drawOrder.length = 0;
    this.propDepth.release();
  }

  clear(): void {
    this.release();
    this.overlays.clear();
    this.interior?.clear();
    this.interior = null;
    this.interiorKey = "";
    this.grass.clear();
    this.propDepth.clear();
  }
}

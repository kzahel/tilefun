import { GrassFrameBuffer } from "./GrassFrameBuffer.js";
import type { SceneItem } from "./SceneItem.js";

/** One client's synchronous presentation storage, independent of the backend.
 * The list and pooled grass records are borrowed until the next collection.
 * Release after drawing so particles and elevation surfaces are not retained.
 */
export class SceneFrame {
  readonly items: SceneItem[] = [];
  readonly grass = new GrassFrameBuffer();

  begin(hasGrass: boolean): SceneItem[] {
    this.release();
    if (!hasGrass) this.grass.clear();
    return this.items;
  }

  release(): void {
    this.items.length = 0;
  }

  clear(): void {
    this.release();
    this.grass.clear();
  }
}

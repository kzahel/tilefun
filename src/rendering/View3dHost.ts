import type * as THREE from "three";
import type { RenderRegion } from "./ViewLayout.js";

/** What a 3D view draws into: the host's renderer, already bound to the view's
 * region of the canvas (viewport and scissor), and the region's size. */
export interface View3dTarget {
  readonly renderer: THREE.WebGLRenderer;
  readonly width: number;
  readonly height: number;
}

/**
 * 3D views of a display frame on the render host's own WebGL context (248): the
 * fixed view and 3D views share one renderer, so they share loaded GPU assets and
 * can sit side by side in one canvas.
 */
export interface View3dHost {
  /** Counts restored graphics contexts. three.js re-uploads scene resources by
   * itself; a view rebuilds anything it tracks beyond that (cached render targets). */
  readonly generation: number;
  /**
   * Draw a 3D view into `region` of the canvas (the whole canvas when omitted).
   * `draw` clears and renders through the given renderer; the host restores its own
   * render state afterwards. Returns false, without calling `draw`, while graphics
   * are lost or the region keeps only part of its rectangle (a diagonal mask).
   */
  draw(region: RenderRegion | undefined, draw: (target: View3dTarget) => void): boolean;
}

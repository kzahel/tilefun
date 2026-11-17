import type { GameAssets } from "../assets/GameAssets.js";
import type { BlendGraph } from "../autotile/BlendGraph.js";
import type { OverlayDraw } from "./OverlayFrame.js";
import type { RenderResources } from "./RenderFrame.js";
import type { View3dHost } from "./View3dHost.js";

/** Browser composition only. A GPU host may provide a separate 2D UI overlay;
 * world presentation never receives its context or loaded image resources.
 */
export interface RenderHost {
  readonly renderer: RenderResources;
  readonly uiContext: CanvasRenderingContext2D;
  setAssets(assets: GameAssets, graph: BlendGraph): void;
  resize(width: number, height: number): void;
  /** Clear a separate UI overlay before scene rendering, if this host has one. */
  beginFrame(): void;
  /** 3D views of the display frame on this host's renderer (248), if it has one. */
  readonly view3d?: View3dHost;
  /** Overlay items on the UI canvas, above every view: building mode's grid and
   * cursor over a view drawn in the 3D scene. */
  drawUiOverlay(items: readonly OverlayDraw[]): void;
  /** Independent snapshot of world plus Canvas UI. */
  captureFrame?(): HTMLCanvasElement;
  dispose(): void;
}
export type RenderHostFactory = (canvas: HTMLCanvasElement) => RenderHost;

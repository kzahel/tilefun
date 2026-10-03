import type { GameAssets } from "../assets/GameAssets.js";
import type { BlendGraph } from "../autotile/BlendGraph.js";
import type { RenderBackend } from "./RenderFrame.js";

/** Browser composition only. A GPU host may provide a separate 2D UI overlay;
 * world presentation never receives its context or loaded image resources.
 */
export interface RenderHost {
  readonly renderer: RenderBackend;
  readonly uiContext: CanvasRenderingContext2D;
  setAssets(assets: GameAssets, graph: BlendGraph): void;
  resize(width: number, height: number): void;
  /** Clear a separate UI overlay before scene rendering, if this host has one. */
  beginFrame(): void;
  dispose(): void;
}
export type RenderHostFactory = (canvas: HTMLCanvasElement) => RenderHost;

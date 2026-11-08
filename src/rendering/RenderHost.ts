import type { GameAssets } from "../assets/GameAssets.js";
import type { BlendGraph } from "../autotile/BlendGraph.js";
import type { Camera } from "./Camera.js";
import type { RenderBackend } from "./RenderFrame.js";

/** Browser composition only. A GPU host may provide a separate 2D UI overlay;
 * world presentation never receives its context or loaded image resources.
 */
export type RendererMode = "canvas" | "gpu" | "gpu-mesh";

export interface RenderHost {
  readonly rendererControl?: {
    readonly mode: RendererMode;
    select(mode: RendererMode): Promise<RendererMode>;
  };
  readonly renderer: RenderBackend;
  readonly uiContext: CanvasRenderingContext2D;
  setAssets(assets: GameAssets, graph: BlendGraph): void;
  resize(width: number, height: number): void;
  /** Clear a separate UI overlay before scene rendering, if this host has one. */
  beginFrame(): void;
  /** World collection and drawing share one aligned frame; finish before HUD. */
  beginWorld(camera: Camera): void;
  endWorld(): void;
  /** Independent snapshot of world plus Canvas UI. */
  captureFrame?(): HTMLCanvasElement;
  dispose(): void;
}
export type RenderHostFactory = (canvas: HTMLCanvasElement) => RenderHost;

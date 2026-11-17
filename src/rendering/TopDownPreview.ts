import type { GameAssets } from "../assets/GameAssets.js";
import type { BlendGraph } from "../autotile/BlendGraph.js";
import { GpuRenderResources } from "./GpuRenderResources.js";
import { createView3dHost } from "./GpuView3d.js";
import { TopDownScene } from "./TopDownScene.js";

/** Offscreen preview resources. No DOM layers, clocks, input or world simulation. */
export class TopDownPreview {
  readonly renderer: GpuRenderResources;
  private readonly target;
  private scene: TopDownScene | undefined;
  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new GpuRenderResources(canvas);
    const r = this.renderer;
    this.target = createView3dHost(
      r.surface,
      r.meshes,
      (chunk) => r.groundImage(chunk),
      undefined,
      (item, shows) => r.bodyImage(item, shows),
    );
  }
  setAssets(assets: GameAssets, graph: BlendGraph) {
    this.scene?.dispose();
    this.renderer.configureAssets(assets, graph);
    // Keep the source map: additive loads become visible to the preview too.
    this.scene = new TopDownScene(assets.sheets);
  }
  get stats() {
    return this.scene?.stats;
  }
  draw(...args: Parameters<TopDownScene["draw"]> extends [unknown, ...infer Rest] ? Rest : never) {
    this.renderer.beginFrame();
    return this.scene?.draw(this.target, ...args) ?? false;
  }
  dispose() {
    this.scene?.dispose();
    this.renderer.dispose();
  }
}

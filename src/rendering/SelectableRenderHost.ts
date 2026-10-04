import type { GameAssets } from "../assets/GameAssets.js";
import type { BlendGraph } from "../autotile/BlendGraph.js";
import { createCanvasRenderHost } from "./CanvasRenderHost.js";
import type { RendererMode, RenderHost, RenderHostFactory } from "./RenderHost.js";

/** Browser composition owns backend changes; the same client/Worker keeps running. */
export async function selectableRenderHostFactory(
  params: URLSearchParams,
): Promise<RenderHostFactory> {
  const initial: RendererMode =
    params.get("renderer") === "gpu" ? (params.has("meshes") ? "gpu-mesh" : "gpu") : "canvas";
  let createGpu =
    initial === "canvas" ? undefined : (await import("./GpuRenderHost.js")).createGpuRenderHost;
  return (canvas) => {
    const create = (mode: RendererMode): RenderHost => {
      canvas.dataset.renderer = "canvas";
      delete canvas.dataset.gpuDevice;
      return mode === "canvas" || !createGpu
        ? createCanvasRenderHost(canvas)
        : createGpu(canvas, { meshes: mode === "gpu-mesh" });
    };
    let current = create(initial);
    let mode: RendererMode = canvas.dataset.renderer === "gpu" ? initial : "canvas";
    let assets: GameAssets | undefined, graph: BlendGraph | undefined;
    let width = canvas.width,
      height = canvas.height;
    let disposed = false,
      switching = false;
    return {
      get renderer() {
        return current.renderer;
      },
      get uiContext() {
        return current.uiContext;
      },
      rendererControl: {
        get mode() {
          return mode;
        },
        async select(next) {
          if (disposed) throw Error("Renderer host is disposed");
          if (switching) throw Error("Renderer change already in progress");
          if (next === mode) return mode;
          switching = true;
          try {
            if (next !== "canvas")
              createGpu ??= (await import("./GpuRenderHost.js")).createGpuRenderHost;
            if (disposed) throw Error("Renderer host was disposed during loading");
            // No await after retiring the old host: publication completes between frames.
            current.dispose();
            current = create(next);
            if (assets && graph) current.setAssets(assets, graph);
            current.resize(width, height);
            mode = canvas.dataset.renderer === "gpu" ? next : "canvas";
            const url = new URL(location.href);
            url.searchParams.delete("renderer");
            url.searchParams.delete("meshes");
            if (mode !== "canvas") url.searchParams.set("renderer", "gpu");
            if (mode === "gpu-mesh") url.searchParams.set("meshes", "");
            history.replaceState(history.state, "", url);
            return mode;
          } finally {
            switching = false;
          }
        },
      },
      setAssets(nextAssets, nextGraph) {
        assets = nextAssets;
        graph = nextGraph;
        current.setAssets(assets, graph);
      },
      resize(w, h) {
        width = w;
        height = h;
        current.resize(w, h);
      },
      beginFrame() {
        current.beginFrame();
      },
      captureFrame() {
        return current.captureFrame?.() ?? canvas;
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        current.dispose();
        assets = undefined;
        graph = undefined;
      },
    };
  };
}

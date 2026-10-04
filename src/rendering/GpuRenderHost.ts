import { createCanvasRenderHost } from "./CanvasRenderHost.js";
import { GpuRenderBackend } from "./GpuRenderBackend.js";
import type { RenderHost } from "./RenderHost.js";

/** The original canvas retains input and UI; the world canvas is a sibling below it. */
export function createGpuRenderHost(
  canvas: HTMLCanvasElement,
  options?: { meshes: boolean; embedded?: boolean },
): RenderHost {
  const world = document.createElement("canvas");
  world.dataset.renderer = "gpu";
  world.setAttribute("aria-hidden", "true");
  world.style.cssText = options?.embedded
    ? "position:absolute;pointer-events:none;"
    : "position:fixed;pointer-events:none;";
  let renderer: GpuRenderBackend;
  try {
    renderer = new GpuRenderBackend(world);
  } catch (error) {
    world.remove();
    console.warn("GPU renderer unavailable; using Canvas", error);
    canvas.dataset.renderer = "canvas-fallback";
    return createCanvasRenderHost(canvas);
  }
  renderer.meshes.setEnabled(options?.meshes ?? new URLSearchParams(location.search).has("meshes"));
  const uiContext = canvas.getContext("2d");
  if (!uiContext) {
    renderer.dispose();
    throw Error("UI canvas unavailable");
  }
  canvas.before(world);
  canvas.dataset.renderer = "gpu";
  const oldPosition = canvas.style.position;
  if (getComputedStyle(canvas).position === "static") canvas.style.position = "relative";
  const align = () => {
    const rect = canvas.getBoundingClientRect();
    // Embedded views supply a positioned wrapper; absolute placement then follows
    // document scrolling without a separate scroll listener or per-frame layout.
    world.style.left = `${options?.embedded ? canvas.offsetLeft : rect.left}px`;
    world.style.top = `${options?.embedded ? canvas.offsetTop : rect.top}px`;
    world.style.width = `${rect.width}px`;
    world.style.height = `${rect.height}px`;
  };
  let disposed = false;
  const lost = (event: Event) => {
    event.preventDefault();
    renderer.surface.lost = true;
    canvas.dataset.gpuDevice = "lost";
  };
  const restored = () => {
    if (disposed) return;
    renderer.surface.lost = false;
    renderer.recover();
    canvas.dataset.gpuDevice = "ready";
  };
  world.addEventListener("webglcontextlost", lost);
  world.addEventListener("webglcontextrestored", restored);
  canvas.dataset.gpuDevice = "ready";
  const observer = new ResizeObserver(align);
  observer.observe(canvas);
  return {
    renderer,
    uiContext,
    setAssets: (assets, graph) => renderer.configureAssets(assets, graph),
    resize(width, height) {
      canvas.width = width;
      canvas.height = height;
      renderer.resize(width, height);
      align();
    },
    beginFrame() {
      uiContext.clearRect(0, 0, canvas.width, canvas.height);
      renderer.beginFrame();
    },
    captureFrame() {
      if (disposed || renderer.surface.lost) throw Error("Graphics are unavailable for capture");
      renderer.surface.flush();
      const copy = document.createElement("canvas");
      copy.width = canvas.width;
      copy.height = canvas.height;
      copy.dataset.generation = canvas.dataset.generation ?? "";
      const ctx = copy.getContext("2d");
      if (!ctx) throw Error("Capture canvas unavailable");
      ctx.drawImage(world, 0, 0);
      ctx.drawImage(canvas, 0, 0);
      return copy;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      world.removeEventListener("webglcontextlost", lost);
      world.removeEventListener("webglcontextrestored", restored);
      renderer.dispose();
      world.remove();
      canvas.style.position = oldPosition;
    },
  };
}

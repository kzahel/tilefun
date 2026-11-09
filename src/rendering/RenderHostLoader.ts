import type { RenderHostFactory } from "./RenderHost.js";
import { requireWebGl2 } from "./WebGl2Support.js";

/** Game and labs share one GPU host; Three loads only once WebGL2 is confirmed. */
export async function loadRenderHostFactory(options?: {
  embedded?: boolean;
}): Promise<RenderHostFactory> {
  requireWebGl2();
  const { createGpuRenderHost } = await import("./GpuRenderHost.js");
  return (canvas) => createGpuRenderHost(canvas, options);
}

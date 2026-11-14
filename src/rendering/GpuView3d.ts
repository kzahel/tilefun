import * as THREE from "three";
import type { GpuRasterSurface } from "./GpuRasterSurface.js";
import type { View3dHost } from "./View3dHost.js";

const clearColor = new THREE.Color();

/**
 * 3D views on the fixed view's renderer (248). A 3D view draws straight into its
 * region of the canvas: three.js encodes colours for display only there, and the
 * canvas has its own depth buffer. The fixed view's world target is left as it
 * was, so fixed and 3D views of one frame can follow each other in any order.
 */
export function createView3dHost(surface: GpuRasterSurface): View3dHost {
  return {
    get generation() {
      return surface.stats.recoveries;
    },
    draw(region, draw) {
      if (surface.disposed || surface.lost || region?.mask) return false;
      surface.flush();
      const { renderer, canvas } = surface;
      const width = region?.width ?? canvas.width,
        height = region?.height ?? canvas.height;
      // GL rows count from the bottom of the canvas.
      const x = region?.x ?? 0,
        y = canvas.height - (region?.y ?? 0) - height;
      const target = renderer.getRenderTarget();
      const clearAlpha = renderer.getClearAlpha();
      renderer.getClearColor(clearColor);
      renderer.setRenderTarget(null);
      renderer.setViewport(x, y, width, height);
      renderer.setScissor(x, y, width, height);
      renderer.setScissorTest(true);
      try {
        draw({ renderer, width, height });
      } finally {
        renderer.setRenderTarget(null);
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, canvas.width, canvas.height);
        renderer.setClearColor(clearColor, clearAlpha);
        renderer.setRenderTarget(target);
      }
      return true;
    },
  };
}

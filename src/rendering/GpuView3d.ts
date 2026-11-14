import * as THREE from "three";
import type { GpuMeshBodies } from "./GpuMeshBodies.js";
import type { GpuRasterSurface } from "./GpuRasterSurface.js";
import type { SharedMeshAssets, View3dHost } from "./View3dHost.js";

const clearColor = new THREE.Color();

/**
 * 3D views on the fixed view's renderer (248). A 3D view draws straight into its
 * region of the canvas: three.js encodes colours for display only there, and the
 * canvas has its own depth buffer. The fixed view's world target is left as it
 * was, so fixed and 3D views of one frame can follow each other in any order.
 */
export function createView3dHost(surface: GpuRasterSurface, bodies: GpuMeshBodies): View3dHost {
  // The fixed view's loaded vehicle meshes and paint atlases, lent to 3D views.
  const meshes: SharedMeshAssets = {
    ready: bodies.ready,
    asset(assetId) {
      const slot = bodies.request(assetId);
      return bodies.ready.has(assetId) ? (slot?.value ?? undefined) : undefined;
    },
    paint: (paint) => bodies.paints.request(paint),
    bindPaint: (object, texture) => bodies.paints.bind(object, texture),
  };
  return {
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
        draw({ renderer, width, height, generation: surface.stats.recoveries, meshes });
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

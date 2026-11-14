import * as THREE from "three";
import { CHUNK_SIZE_PX } from "../config/constants.js";
import type { Chunk } from "../world/Chunk.js";
import type { GpuMeshBodies } from "./GpuMeshBodies.js";
import type { GpuRasterSurface } from "./GpuRasterSurface.js";
import type { SharedMeshAssets, SharedPages, View3dHost } from "./View3dHost.js";

const clearColor = new THREE.Color();
const GROUND_SIZE = { width: CHUNK_SIZE_PX, height: CHUNK_SIZE_PX };
/** Ground pages one 3D view may upload in a display frame (256 KiB each); chunks
 * beyond that draw their flat colours until a later frame. */
export const GROUND_UPLOADS_PER_VIEW = 4;

/**
 * 3D views on the fixed view's renderer (248). A 3D view draws straight into its
 * region of the canvas: three.js encodes colours for display only there, and the
 * canvas has its own depth buffer. The fixed view's world target is left as it
 * was, so fixed and 3D views of one frame can follow each other in any order.
 */
export function createView3dHost(
  surface: GpuRasterSurface,
  bodies: GpuMeshBodies,
  /** A chunk's prepared ground image, if it has one. */
  groundImage: (chunk: Chunk) => CanvasImageSource | null,
): View3dHost {
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
  // The fixed view's page atlas, lent the same way. A page a 3D view asks for is
  // marked used this frame, exactly as if the fixed view had drawn it.
  let uploads = 0;
  const pages: SharedPages = {
    get atlas() {
      return surface.pages.atlas.texture;
    },
    ground(chunk) {
      const image = groundImage(chunk);
      if (!image) return undefined;
      if (!surface.pages.pages.has(image)) {
        if (uploads >= GROUND_UPLOADS_PER_VIEW) return undefined;
        uploads++;
      }
      return surface.pages.get(image, 0, 0, GROUND_SIZE).region ?? undefined;
    },
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
      uploads = 0;
      try {
        draw({ renderer, width, height, generation: surface.stats.recoveries, meshes, pages });
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

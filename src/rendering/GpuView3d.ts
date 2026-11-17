import * as THREE from "three";
import { CHUNK_SIZE_PX } from "../config/constants.js";
import type { Chunk } from "../world/Chunk.js";
import type { GpuMeshBodies } from "./GpuMeshBodies.js";
import { PAGE } from "./GpuPages.js";
import type { GpuSceneSurface } from "./GpuSceneSurface.js";
import { createXrHost } from "./GpuXr.js";
import type { SharedMeshAssets, SharedPages, View3dHost, View3dTarget } from "./View3dHost.js";

const clearColor = new THREE.Color();
const GROUND_SIZE = { width: CHUNK_SIZE_PX, height: CHUNK_SIZE_PX };
/** Ground pages one 3D view may upload in a display frame (256 KiB each); chunks
 * beyond that draw their flat colours until a later frame. */
export const GROUND_UPLOADS_PER_VIEW = 4;

/** Unified views draw into their own canvas regions, with display colour encoding
 * and a depth buffer shared by the scene's content. */
export function createView3dHost(
  surface: GpuSceneSurface,
  bodies: GpuMeshBodies,
  /** A chunk's prepared ground image, if it has one. */
  groundImage: (chunk: Chunk) => CanvasImageSource | null,
  /** A headset session gave the renderer back (252): size it to the page. */
  restored: () => void = () => surface.resize(surface.canvas.width, surface.canvas.height),
  /** The shared finished image of a vehicle body (`GpuMeshBodies.bodyImage`). */
  bodyImage?: SharedMeshAssets["bodyImage"],
): View3dHost {
  // Loaded vehicle meshes and paint atlases shared by every view.
  const meshes: SharedMeshAssets = {
    ready: bodies.ready,
    asset(assetId) {
      const slot = bodies.request(assetId);
      return bodies.ready.has(assetId) ? (slot?.value ?? undefined) : undefined;
    },
    paint: (paint) => bodies.paints.request(paint),
    bindPaint: (object, texture) => bodies.paints.bind(object, texture),
    ...(bodyImage && { bodyImage }),
  };
  // Requested pages are marked used in the shared atlas for this frame.
  let uploads = 0;
  // The image each chunk's ground last came from: while a replacement waits for
  // its upload, the chunk keeps wearing this one instead of going flat.
  const worn = new WeakMap<Chunk, CanvasImageSource>();
  const pages: SharedPages = {
    get atlas() {
      return surface.pages.atlas.texture;
    },
    ground(chunk) {
      let image = groundImage(chunk);
      if (!image) return undefined;
      if (!surface.pages.pages.has(image)) {
        if (uploads < GROUND_UPLOADS_PER_VIEW) uploads++;
        else {
          const previous = worn.get(chunk);
          if (!previous || !surface.pages.pages.has(previous)) return undefined;
          image = previous;
        }
      }
      worn.set(chunk, image);
      return surface.pages.get(image, 0, 0, GROUND_SIZE).region ?? undefined;
    },
    pageSize: PAGE,
    page: (image, x, y) =>
      surface.pages.get(image, x, y, surface.pages.imageSize(image)).region ?? undefined,
  };
  const viewTarget = (width: number, height: number): View3dTarget => {
    uploads = 0;
    return {
      renderer: surface.renderer,
      width,
      height,
      generation: surface.stats.recoveries,
      meshes,
      pages,
    };
  };
  return {
    get available() {
      return !surface.disposed && !surface.lost;
    },
    xr: createXrHost(surface, viewTarget, restored),
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
        draw(viewTarget(width, height));
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

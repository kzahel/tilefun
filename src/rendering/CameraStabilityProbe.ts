import { Spritesheet } from "../assets/Spritesheet.js";
import { CHUNK_SIZE_PX } from "../config/constants.js";
import { Chunk } from "../world/Chunk.js";
import { Camera } from "./Camera.js";
import { GpuRenderBackend } from "./GpuRenderBackend.js";
import { touchRaster } from "./RasterSurface.js";
import type { SceneItem, SpriteItem } from "./SceneItem.js";

class ProbeGpuBackend extends GpuRenderBackend {
  ground(chunk: Chunk) {
    return this.terrain.getTerrainSurface(chunk);
  }
}

/** Stationary terrain, fractional prop anchors and frozen grass must translate as
 * one image when only the camera moves. This checks raster pixels, not just the
 * camera formula, including the real terrain resource path.
 * Solid landmarks isolate placement from nearest-neighbor texel tie behavior.
 */
export function probeCameraStability(pixelSnap = true) {
  const makeCanvas = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 385;
    canvas.height = 289;
    return canvas;
  };
  const output = makeCanvas();
  const readback = makeCanvas().getContext("2d", { willReadFrequently: true });
  if (!readback) throw Error("Camera stability probe requires Canvas2D");
  const gpu = new ProbeGpuBackend(output);
  const source = new OffscreenCanvas(32, 32);
  const paint = source.getContext("2d");
  if (!paint) throw Error("Camera stability probe requires OffscreenCanvas");
  paint.fillStyle = "#fa7345";
  paint.fillRect(0, 0, 32, 32);
  const sheets = new Map([
    ["fixture", new Spritesheet(source, 16, 16)],
    ["grass-blades", new Spritesheet(source, 8, 8)],
  ]);
  gpu.setAssets(sheets);
  const camera = new Camera();
  camera.pixelSnap = pixelSnap;
  camera.setViewport(output.width, output.height);
  const chunk = new Chunk();
  const reports = [];
  try {
    for (const cx of [-1, 0]) {
      const base = cx * CHUNK_SIZE_PX;
      const range = { minCx: cx, maxCx: cx, minCy: cx, maxCy: cx };
      const world = {
        getChunkIfLoaded: (x: number, y: number) => (x === cx && y === cx ? chunk : undefined),
        getRoadAt: () => 0,
      };
      camera.snapTo(base + 128.13, base + 128.29);
      gpu.prepareTerrain(camera, world, range, { scope: "visible", rowBudget: 16 });
      const ground = gpu.ground(chunk);
      const groundContext = ground?.getContext("2d");
      if (!ground || !groundContext) throw Error("Missing prepared probe terrain");
      groundContext.fillStyle = "#184c18";
      groundContext.fillRect(0, 0, CHUNK_SIZE_PX, CHUNK_SIZE_PX);
      groundContext.fillStyle = "#ff0000";
      groundContext.fillRect(80, 112, 7, 11);
      touchRaster(ground);
      const sprite: SpriteItem = {
        kind: "sprite",
        sortKey: 106,
        wx: base + 88.13,
        wy: base + 106.29,
        zOffset: 0,
        drawOffsetY: 0,
        sheetKey: "fixture",
        frameCol: 0,
        frameRow: 0,
        spriteWidth: 16,
        spriteHeight: 16,
        flipX: false,
        hasShadow: false,
        shadowFeetWy: 0,
        shadowWidth: 0,
        shadowTerrainZ: 0,
        flashHidden: false,
      };
      const items: SceneItem[] = [
        sprite,
        { ...sprite, wx: base + 116.61, wy: base + 100.17, flipX: true },
        // Keep rotated edges away from raster sample ties. Skia and GPU
        // rasterizers resolve those ties differently across architectures;
        // this probe measures rigid placement with exact pixel comparisons.
        { kind: "grass", sortKey: 97, wx: base + 140, wy: base + 97, variant: 0, angle: 0.125 },
      ];
      for (const zoom of [0.4, 0.5, 0.8, 1, 1.3]) {
        camera.zoom = zoom;
        let baseline: Uint8ClampedArray | undefined;
        let origin: { sx: number; sy: number } | undefined;
        let mismatches = 0,
          movedFrames = 0;
        for (const phase of [0, 0.2, 0.4, 0.6, 0.8, 1.2, 2.4]) {
          camera.x = base + 128.13 + phase / camera.scale;
          camera.y = base + 128.29 - phase / camera.scale;
          gpu.beginFrame();
          gpu.submit(camera, { kind: "clear", color: "#000000" });
          gpu.submit(camera, {
            kind: "terrain",
            draws: gpu.collectTerrain(camera, world, range),
          });
          gpu.submit(camera, { kind: "scene", items, order: [0, 1, 2] });
          readback.clearRect(0, 0, output.width, output.height);
          readback.drawImage(output, 0, 0);
          const pixels = readback.getImageData(0, 0, output.width, output.height).data;
          const currentOrigin = camera.worldToScreen(base, base);
          if (!baseline || !origin) {
            baseline = pixels;
            origin = currentOrigin;
            continue;
          }
          const dx = Math.round(currentOrigin.sx - origin.sx);
          const dy = Math.round(currentOrigin.sy - origin.sy);
          if (dx || dy) movedFrames++;
          // Exclude viewport boundaries, where moving content legitimately enters/leaves.
          for (let y = 8; y < output.height - 8; y++) {
            for (let x = 8; x < output.width - 8; x++) {
              const a = (y * output.width + x) * 4;
              const b = ((y - dy) * output.width + x - dx) * 4;
              for (let channel = 0; channel < 4; channel++) {
                if (pixels[a + channel] !== baseline[b + channel]) {
                  mismatches++;
                  break;
                }
              }
            }
          }
        }
        reports.push({ cx, zoom, pixelSnap, mismatches, movedFrames });
      }
      gpu.releaseChunk(chunk);
    }
    return reports;
  } finally {
    gpu.dispose();
  }
}

import { Spritesheet } from "../assets/Spritesheet.js";
import { Camera } from "./Camera.js";
import { CanvasRenderBackend } from "./CanvasRenderBackend.js";
import { GpuRenderBackend } from "./GpuRenderBackend.js";
import type { SpriteItem } from "./SceneItem.js";

/** Browser regression fixture: adjacent translucent pieces must cover a rectangle
 * exactly once, including at fractional zoom and camera positions. */
export function probeSpriteSeams(pixelSnap = false) {
  const makeCanvas = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 960;
    canvas.height = 640;
    return canvas;
  };
  const reference = makeCanvas();
  const canvas = makeCanvas();
  const readback = makeCanvas().getContext("2d", { willReadFrequently: true });
  const ctx = reference.getContext("2d", { willReadFrequently: true });
  if (!readback || !ctx) throw Error("Sprite seam probe requires Canvas2D");
  const native = new CanvasRenderBackend(ctx, new Map());
  const gpu = new GpuRenderBackend(canvas);
  const source = makeCanvas();
  const paint = source.getContext("2d");
  if (!paint) throw Error("Sprite seam probe requires Canvas2D");
  paint.fillStyle = "#51be49";
  paint.fillRect(0, 0, source.width, source.height);
  const sheets = new Map([["solid", new Spritesheet(source, 16, 16)]]);
  native.setAssets(sheets);
  gpu.setAssets(sheets);
  const camera = new Camera();
  camera.pixelSnap = pixelSnap;
  camera.setViewport(960, 640);
  const reports = [];
  try {
    for (const zoom of [0.4, 0.8, 1, 1.3]) {
      for (const phase of [0, 0.21, -0.37, 1000000.21]) {
        camera.zoom = zoom;
        camera.x = phase;
        camera.y = phase;
        const origin = Math.trunc(phase);
        const items: SpriteItem[] = [];
        let y = origin - 64;
        for (const height of [48, 80]) {
          let x = origin - 104;
          for (const width of [48, 128, 32]) {
            items.push({
              kind: "sprite",
              sortKey: y,
              wx: x + width / 2,
              wy: y + height,
              zOffset: 8,
              drawOffsetY: 3,
              sheetKey: "solid",
              frameCol: 0,
              frameRow: 0,
              spriteWidth: width,
              spriteHeight: height,
              flipX: width === 128,
              hasShadow: false,
              shadowFeetWy: 0,
              shadowWidth: 0,
              shadowTerrainZ: 0,
              flashHidden: false,
              alpha: 0.5,
            });
            x += width;
          }
          y += height;
        }
        const view = {
          x: camera.x,
          y: camera.y,
          zoom,
          viewportWidth: 960,
          viewportHeight: 640,
          pixelSnap,
        };
        const tl = camera.worldToScreen(origin - 104, origin - 64 - 5);
        const br = camera.worldToScreen(origin + 104, origin + 64 - 5);
        const left = Math.floor(tl.sx),
          top = Math.floor(tl.sy);
        const width = Math.floor(br.sx) - left,
          height = Math.floor(br.sy) - top;
        for (const [name, backend, image] of [
          ["canvas", native, reference],
          ["gpu", gpu, canvas],
        ] as const) {
          if (backend === gpu) gpu.beginFrame();
          backend.submit(view, { kind: "clear", color: "#243245" });
          backend.submit(view, {
            kind: "scene",
            items,
            order: items.map((_, i) => i),
            pixelExactShadows: true,
          });
          readback.drawImage(image, 0, 0);
          const data = readback.getImageData(left, top, width, height).data;
          const sample = (5 * width + 5) * 4;
          let mismatches = 0;
          for (let i = 0; i < data.length; i += 4) {
            if ([0, 1, 2, 3].some((channel) => data[i + channel] !== data[sample + channel]))
              mismatches++;
          }
          reports.push({ renderer: name, zoom, phase, mismatches });
        }
      }
    }
    return reports;
  } finally {
    native.dispose();
    gpu.dispose();
  }
}

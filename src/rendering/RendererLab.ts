import { Spritesheet } from "../assets/Spritesheet.js";
import { CanvasRenderBackend } from "./CanvasRenderBackend.js";
import { GpuRenderBackend } from "./GpuRenderBackend.js";
import { touchRaster } from "./RasterSurface.js";
import { collectSceneOrder, type RenderPass } from "./RenderFrame.js";
import type { SceneItem, SpriteItem } from "./SceneItem.js";

function required<T>(value: T | null | undefined): T {
  if (value == null) throw Error("Missing renderer lab element");
  return value;
}

const reference = required(document.querySelector<HTMLCanvasElement>("#reference"));
const canvas = required(document.querySelector<HTMLCanvasElement>("#gpu"));
const result = required(document.querySelector<HTMLElement>("#result"));
const context = required(reference.getContext("2d", { willReadFrequently: true }));
const native = new CanvasRenderBackend(context, new Map());
const gpu = new GpuRenderBackend(canvas);
const atlas = document.createElement("canvas");
atlas.width = 64;
atlas.height = 32;
const paint = required(atlas.getContext("2d"));
paint.fillStyle = "#51be49";
paint.fillRect(0, 0, 32, 32);
paint.fillStyle = "#246333";
for (let i = 0; i < 32; i += 4) paint.fillRect(i, 0, 2, 32);
paint.fillStyle = "#fa7345";
paint.fillRect(32, 0, 32, 32);
paint.clearRect(40, 8, 8, 8);
paint.fillStyle = "rgba(30,60,240,.5)";
paint.fillRect(48, 8, 8, 16);
const sheets = new Map([["fixture", new Spritesheet(atlas, 32, 32)]]);
native.setAssets(sheets);
gpu.setAssets(sheets);
const view = { x: 0, y: 0, zoom: 1, viewportWidth: 384, viewportHeight: 288 };
const sprite = (x: number, y: number, col: number): SpriteItem => ({
  kind: "sprite",
  sortKey: y,
  wx: x,
  wy: y,
  zOffset: 0,
  sheetKey: "fixture",
  frameCol: col,
  frameRow: 0,
  spriteWidth: 32,
  spriteHeight: 32,
  flipX: false,
  drawOffsetY: 0,
  hasShadow: true,
  shadowFeetWy: y,
  shadowWidth: 24,
  shadowTerrainZ: 0,
  flashHidden: false,
});
const items: SceneItem[] = [
  sprite(-32, 0, 0),
  sprite(-16, 16, 1),
  { ...sprite(20, 24, 1), flipX: true, zOffset: 8 },
  { kind: "particle", wx: 0, wy: 0, z: 16, size: 4, color: "#f8dd17", alpha: 0.5, sortKey: 100 },
];
let clips = false;
function draw() {
  gpu.beginFrame();
  const sceneItems = clips ? items.map(item => item.kind === "sprite" ? {...item, hasShadow:false} : item) : items;
  const passes: RenderPass[] = [
    { kind: "clear", color: "#243245" },
    {
      kind: "scene",
      items: sceneItems,
      order: collectSceneOrder(sceneItems, []),
      pixelExactShadows: true,
      ...(clips
        ? {
            clipRects: [
              { x: 70, y: 40, width: 140, height: 170 },
              { x: 140, y: 80, width: 160, height: 170 },
            ],
          }
        : {}),
    },
  ];
  for (const pass of passes) {
    native.submit(view, pass);
    gpu.submit(view, pass);
  }
  const output = document.createElement("canvas");
  output.width = 384;
  output.height = 288;
  const ctx = required(output.getContext("2d", { willReadFrequently: true }));
  ctx.drawImage(canvas, 0, 0);
  const a = context.getImageData(0, 0, 384, 288).data,
    b = ctx.getImageData(0, 0, 384, 288).data;
  let mismatches = 0,
    maxError = 0;
  for (let i = 0; i < a.length; i += 4) {
    let error = 0;
    for (let c = 0; c < 4; c++)
      error = Math.max(error, Math.abs((a[i + c] ?? 0) - (b[i + c] ?? 0)));
    if (error > 1) mismatches++;
    maxError = Math.max(maxError, error);
  }
  const report = { mismatches, maxError, ...gpu.surface.stats };
  result.textContent = JSON.stringify(report, null, 2);
  canvas.dataset.ready = "true";
  return report;
}
const lab = {
  draw,
  setClips(value: boolean) {
    clips = value;
    return draw();
  },
  changeTexture() {
    paint.fillStyle = "#7722dd";
    paint.fillRect(0, 0, 8, 8);
    touchRaster(atlas);
    return draw();
  },
  recover() {
    gpu.recover();
    return draw();
  },
  dispose() {
    native.dispose();
    gpu.dispose();
  },
  gpu,
};
(window as unknown as { rendererLab: typeof lab }).rendererLab = lab;
draw();
window.addEventListener("pagehide", () => lab.dispose(), { once: true });

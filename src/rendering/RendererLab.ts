import { loadModernInteriorsAtlasIndex } from "../assets/ModernInteriorsAtlasIndex.js";
import { Spritesheet } from "../assets/Spritesheet.js";
import { Direction } from "../entities/Entity.js";
import type { InteriorContent } from "../interiors/InteriorPresentation.js";
import { vehicleFrameDirection } from "../traffic/Vehicle.js";
import { CanvasRenderBackend } from "./CanvasRenderBackend.js";
import { GpuRenderBackend } from "./GpuRenderBackend.js";
import { COMPACT_CAR_MESH, poseOrientation, yawOrientation } from "./MeshPresentation.js";
import { OverlayFrame } from "./OverlayFrame.js";
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
let meshMode = false;
let carMode = false;
let carSpriteLoaded = false;
let interior: InteriorContent | null = null;
let overlayMode = false;
let smoothShadows = false;
let foreground = false;
const car = {
  ...sprite(0, 24, 1),
  hasShadow: false,
  mesh: { assetId: COMPACT_CAR_MESH, orientation: yawOrientation(Math.PI), radius: 64 },
};

function draw() {
  gpu.beginFrame();
  const selectedItems = carMode ? [items[0] as SceneItem, car, items[3] as SceneItem] : items;
  if (carMode && foreground) selectedItems.reverse();
  const sceneItems = clips
    ? selectedItems.map((item) => (item.kind === "sprite" ? { ...item, hasShadow: false } : item))
    : selectedItems;
  const passes: RenderPass[] = [
    { kind: "clear", color: "#243245" },
    {
      kind: "scene",
      items: sceneItems,
      order: collectSceneOrder(sceneItems, []),
      pixelExactShadows: !smoothShadows,
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
  if (interior) {
    native.prepareInterior(interior);
    gpu.prepareInterior(interior);
    passes.splice(1, 1, {
      kind: "interior",
      contentId: interior.id,
      draws: [
        { kind: "layer", layer: "floor" },
        { kind: "layer", layer: "walls" },
        { kind: "wall-band", row: 0, y: -16 },
        { kind: "furniture", src: [240, 8078, 16, 16], x: 8, y: 8, width: 24, height: 32 },
        {
          kind: "scene",
          item: { ...sprite(8, 32, 1), hasShadow: false },
          offsetY: 4,
          shadow: false,
        },
      ],
    });
  }
  if (overlayMode) {
    const frame = new OverlayFrame();
    const box = frame.next("rect");
    Object.assign(box, {
      x: 8,
      y: 8,
      width: 90,
      height: 30,
      fill: "#175c55",
      stroke: "#eebb66",
      lineWidth: 2,
      alpha: 0.7,
    });
    const label = frame.next("text");
    Object.assign(label, {
      x: 16,
      y: 28,
      text: "GPU test",
      font: "12px sans-serif",
      fill: "white",
    });
    passes.push({ kind: "overlay", items: frame.items });
  }
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
  const report = {
    mismatches,
    maxError,
    ...gpu.surface.stats,
    meshDraws: gpu.meshes.draws,
    meshState: gpu.meshes.car.state,
    targetBytes: gpu.meshes.targetBytes,
  };
  result.textContent = JSON.stringify(report, null, 2);
  canvas.dataset.ready = "true";
  return report;
}
function setCarHeading(yaw: number) {
  const direction =
    Math.abs(Math.cos(yaw)) > Math.abs(Math.sin(yaw))
      ? Math.cos(yaw) > 0
        ? Direction.Right
        : Direction.Left
      : Math.sin(yaw) > 0
        ? Direction.Down
        : Direction.Up;
  if (carSpriteLoaded) car.frameRow = vehicleFrameDirection("vehicle-v1:compact-1", direction);
}
const lab = {
  draw,
  async probeWebGpu(forceWebGL = false) {
    const { probeWebGpuAsset } = await import("./WebGpuAssetProbe.js");
    return probeWebGpuAsset(forceWebGL);
  },
  async setMesh(value: boolean) {
    meshMode = value;
    carMode = true;
    if (!carSpriteLoaded) {
      const image = new Image();
      image.src = `${import.meta.env.BASE_URL}assets/vehicles/compact-1-v1.png`;
      await image.decode();
      sheets.set("vehicle-v1:compact-1", new Spritesheet(image, 192, 224));
      native.addSpriteAssets(sheets);
      gpu.addSpriteAssets(sheets);
      Object.assign(car, {
        sheetKey: "vehicle-v1:compact-1",
        spriteWidth: 192,
        spriteHeight: 224,
        frameCol: 0,
        frameRow: vehicleFrameDirection("vehicle-v1:compact-1", Direction.Left),
        drawOffsetY: 80,
      });
      carSpriteLoaded = true;
    }
    gpu.meshes.setEnabled(value);
    while (value && gpu.meshes.car.state === "loading")
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    return draw();
  },
  setSmoothShadows(value: boolean) {
    smoothShadows = value;
    return draw();
  },
  setZoom(value: number) {
    view.zoom = value;
    return draw();
  },
  async setInterior(value: boolean) {
    if (value) {
      await loadModernInteriorsAtlasIndex();
      const image = new Image();
      image.src = `${import.meta.env.BASE_URL}assets/tilesets/modern-interiors-atlas.png`;
      await image.decode();
      sheets.set("modern-interiors", new Spritesheet(image, 16, 16));
      native.setAssets(sheets);
      gpu.setAssets(sheets);
      interior = {
        id: 1,
        editable: true,
        map: {
          width: 4,
          height: 4,
          pixelHeight: 64,
          contentOffsetY: 4,
          cells: Array.from({ length: 4 }, (_, y) =>
            Array.from({ length: 4 }, () => ({
              semantic: "floor",
              floor: [{ key: "room-builder/floor-connectors/c00-r00" }],
              wall: y === 0 ? [{ key: "room-builder/floor-connectors/c00-r01" }] : [],
              foreground: [],
              objects: [],
            })),
          ),
        },
      };
    } else interior = null;
    return draw();
  },
  setOverlay(value: boolean) {
    overlayMode = value;
    return draw();
  },
  setForeground(value: boolean) {
    foreground = value;
    return draw();
  },
  setPose(yaw: number, pitch: number, roll: number) {
    setCarHeading(yaw);
    car.mesh.orientation = poseOrientation(yaw, pitch, roll);
    return draw();
  },
  setYaw(radians: number) {
    setCarHeading(radians);
    car.mesh.orientation = yawOrientation(radians);
    return draw();
  },
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
const controls = required(document.querySelector<HTMLElement>("#controls"));
const toggle = document.createElement("button");
toggle.textContent = "Show diagnostic mesh car";
toggle.onclick = async () => {
  toggle.disabled = true;
  await lab.setMesh(!meshMode);
  toggle.textContent = meshMode ? "Show car sprite fallback" : "Show diagnostic mesh car";
  toggle.disabled = false;
};
controls.append(toggle);
const heading = document.createElement("input");
heading.type = "range";
heading.min = "-180";
heading.max = "180";
heading.value = "180";
heading.setAttribute("aria-label", "Car heading");
heading.oninput = () => lab.setYaw((Number(heading.value) * Math.PI) / 180);
controls.append(heading);
const pitch = document.createElement("input"),
  roll = document.createElement("input");
for (const [input, name] of [
  [pitch, "Car pitch"],
  [roll, "Car roll"],
] as const) {
  input.type = "range";
  input.min = "-45";
  input.max = "45";
  input.value = "0";
  input.setAttribute("aria-label", name);
  controls.append(input);
}
const updatePose = () =>
  lab.setPose(
    (Number(heading.value) * Math.PI) / 180,
    (Number(pitch.value) * Math.PI) / 180,
    (Number(roll.value) * Math.PI) / 180,
  );
heading.oninput = pitch.oninput = roll.oninput = updatePose;

for (const forceWebGL of [false, true]) {
  const probe = document.createElement("button");
  probe.textContent = forceWebGL ? "Probe WebGL2 asset" : "Probe WebGPU asset";
  probe.onclick = async () => {
    probe.disabled = true;
    try {
      result.textContent = JSON.stringify(await lab.probeWebGpu(forceWebGL), null, 2);
    } catch (error) {
      result.textContent = String(error);
    } finally {
      probe.disabled = false;
    }
  };
  controls.append(probe);
}

draw();
window.addEventListener("pagehide", () => lab.dispose(), { once: true });

import { loadModernInteriorsAtlasIndex } from "../assets/ModernInteriorsAtlasIndex.js";
import { Spritesheet } from "../assets/Spritesheet.js";
import { TerrainId } from "../autotile/TerrainId.js";
import { Direction } from "../entities/Entity.js";
import type { InteriorContent } from "../interiors/InteriorPresentation.js";
import { vehicleFrameDirection } from "../traffic/Vehicle.js";
import { Chunk } from "../world/Chunk.js";
import { Camera } from "./Camera.js";
import { probeCameraStability } from "./CameraStabilityProbe.js";
import { collectScene } from "./collectScene.js";
import { probeDeferredShadows } from "./DeferredShadowProbe.js";
import { GpuRenderBackend } from "./GpuRenderBackend.js";
import { COMPACT_CAR_MESH, poseOrientation, yawOrientation } from "./MeshPresentation.js";
import { OverlayFrame } from "./OverlayFrame.js";
import { touchRaster } from "./RasterSurface.js";
import {
  clipErrors,
  difference,
  fadeError,
  fillError,
  histogram,
  paletteCounts,
} from "./RendererLabChecks.js";
import { collectSceneOrder, type RenderPass } from "./RenderFrame.js";
import { SceneFrame } from "./SceneFrame.js";
import type { SceneItem, SpriteItem } from "./SceneItem.js";
import { probeSpriteSeams } from "./SpriteSeamProbe.js";
import { probeSurfaceDecals } from "./SurfaceDecalProbe.js";
import { probeTerrainRasterCompletion } from "./TerrainRasterProbe.js";
import { probeVehicleDepth } from "./VehicleDepthProbe.js";
import { probeViewRegions } from "./ViewRegionProbe.js";
import { probeWorldRegistration } from "./WorldRegistrationProbe.js";

function required<T>(value: T | null | undefined): T {
  if (value == null) throw Error("Missing renderer lab element");
  return value;
}

const canvas = required(document.querySelector<HTMLCanvasElement>("#gpu"));
const result = required(document.querySelector<HTMLElement>("#result"));
const gpu = new GpuRenderBackend(canvas);
const readback = document.createElement("canvas");
readback.width = 384;
readback.height = 288;
const readContext = required(readback.getContext("2d", { willReadFrequently: true }));
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
const CLIPS = [
  { x: 70, y: 40, width: 140, height: 170 },
  { x: 140, y: 80, width: 160, height: 170 },
];
const OVERLAY = { x: 8, y: 8, width: 90, height: 30, fill: "#175c55", alpha: 0.7 };
const grassFrame = new SceneFrame();
let grassItems: SceneItem[] | null = null;
let clips = false;
let meshMode = false;
let carMode = false;
let carSpriteLoaded = false;
let interior: InteriorContent | null = null;
let overlayMode = false;
let foreground = false;
let frame = new Uint8ClampedArray(0);
const car = {
  ...sprite(0, 24, 1),
  hasShadow: false,
  mesh: { assetId: COMPACT_CAR_MESH, orientation: yawOrientation(Math.PI), radius: 64 },
};

function meshless(): SpriteItem {
  const { mesh: _mesh, ...plain } = car;
  return plain;
}

type FrameOptions = {
  clips?: boolean;
  overlay?: boolean;
  shadows?: boolean;
  smoothShadows?: boolean;
  grassAlpha?: number;
  /** Only blades that do not overlap: overlapping translucent blades do not fade linearly. */
  separateBlades?: boolean;
  meshlessCar?: boolean;
};

function sceneItemsFor(options: FrameOptions): SceneItem[] {
  let selected =
    grassItems ??
    (carMode
      ? [items[0] as SceneItem, options.meshlessCar ? meshless() : car, items[3] as SceneItem]
      : items);
  if (carMode && foreground) selected = [...selected].reverse();
  if (options.separateBlades) {
    const kept: SceneItem[] = [];
    selected = selected.filter((item) => {
      if (item.kind !== "grass") return true;
      if (
        kept.some((other) => Math.abs(other.wx - item.wx) < 16 && Math.abs(other.wy - item.wy) < 16)
      )
        return false;
      kept.push(item);
      return true;
    });
  }
  if (options.grassAlpha !== undefined) {
    const alpha = options.grassAlpha;
    selected = selected.flatMap((item): SceneItem[] =>
      item.kind !== "grass" ? [item] : alpha > 0 ? [{ ...item, alpha }] : [],
    );
  }
  return options.clips || options.shadows === false
    ? selected.map((item) => (item.kind === "sprite" ? { ...item, hasShadow: false } : item))
    : selected;
}

/** Render one GPU frame and read its pixels back in the same task. */
function render(options: FrameOptions = {}) {
  gpu.beginFrame();
  const sceneItems = sceneItemsFor(options);
  const passes: RenderPass[] = [
    { kind: "clear", color: grassItems ? "#638543" : "#243245" },
    {
      kind: "scene",
      items: sceneItems,
      order: collectSceneOrder(sceneItems, []),
      pixelExactShadows: !options.smoothShadows,
      ...(options.clips ? { clipRects: CLIPS } : {}),
    },
  ];
  if (interior) {
    gpu.prepareInterior(interior);
    passes.splice(1, 1, {
      kind: "interior",
      contentId: interior.id,
      draws: [
        { kind: "layer", layer: "floor" },
        { kind: "layer", layer: "walls" },
        { kind: "wall-band", row: 0, y: -16 },
        // Integer texel scaling avoids nearest-neighbor half-texel ties, which
        // resolve differently across GPUs and architectures (x64 vs ARM).
        { kind: "furniture", src: [240, 8078, 16, 16], x: 8, y: 8, width: 32, height: 32 },
        {
          kind: "scene",
          item: { ...sprite(8, 32, 1), hasShadow: false },
          offsetY: 4,
          shadow: false,
        },
      ],
    });
  }
  if (options.overlay) {
    const overlay = new OverlayFrame();
    const { fill, alpha, ...bounds } = OVERLAY;
    Object.assign(overlay.next("rect"), {
      ...bounds,
      fill,
      stroke: "#eebb66",
      lineWidth: 2,
      alpha,
    });
    Object.assign(overlay.next("text"), {
      x: 16,
      y: 28,
      text: "GPU test",
      font: "12px sans-serif",
      fill: "white",
    });
    passes.push({ kind: "overlay", items: overlay.items });
  }
  for (const pass of passes) gpu.submit(view, pass);
  readContext.clearRect(0, 0, 384, 288);
  readContext.drawImage(canvas, 0, 0);
  return { pixels: readContext.getImageData(0, 0, 384, 288).data, sceneItems };
}

function draw() {
  const checks: Record<string, number> = {};
  const clear = grassItems ? "#638543" : "#243245";
  // Derived frames first, so the displayed GPU canvas and `frame` show the case itself.
  // Each check compares frames that differ only in the mode it checks.
  const unclipped = clips ? render({ shadows: false }).pixels : undefined;
  const clippedAlone = clips && overlayMode ? render({ clips }).pixels : undefined;
  const plain = overlayMode ? render({ clips }).pixels : undefined;
  const grassAlpha = grassItems?.find((item) => item.kind === "grass")?.alpha ?? 1;
  const fade = grassItems
    ? {
        frame: render({ separateBlades: true }).pixels,
        full: render({ separateBlades: true, grassAlpha: 1 }).pixels,
        none: render({ separateBlades: true, grassAlpha: 0 }).pixels,
      }
    : undefined;
  const { pixels, sceneItems } = render({ clips, overlay: overlayMode });
  frame = pixels;
  if (unclipped) {
    const clip = clipErrors(clippedAlone ?? pixels, unclipped, 384, CLIPS, clear);
    checks.clipErrors = clip.errors;
    checks.clipOutsideContent = clip.outsideContent;
  }
  if (plain) {
    const { x, y, width, height, fill, alpha } = OVERLAY;
    // The 2 px stroke straddles the rectangle edge.
    checks.overlayOutside = difference(pixels, plain, 384, {
      x: x - 1,
      y: y - 1,
      width: width + 2,
      height: height + 2,
    }).outside;
    // Right of the label and inside the stroke: the fill at the item's alpha.
    checks.overlayFillError = fillError(
      pixels,
      plain,
      384,
      { x: 76, y: 11, width: 20, height: 24 },
      fill,
      alpha,
    );
  }
  if (fade) {
    checks.fadeError = fadeError(fade.frame, fade.full, fade.none, grassAlpha);
    checks.fadeBlades = sceneItemsFor({ separateBlades: true }).filter(
      (item) => item.kind === "grass",
    ).length;
  }
  const report = {
    ...checks,
    grassCount: sceneItems.filter((item) => item.kind === "grass").length,
    grassAlpha,
    ...gpu.surface.stats,
    meshDraws: gpu.meshes.draws,
    meshState: gpu.meshes.car.state,
    meshAsset: gpu.meshes.car.value ? COMPACT_CAR_MESH : null,
    meshParts: gpu.meshes.car.value?.meshCount ?? 0,
    targetBytes: gpu.meshes.targetBytes,
  };
  result.textContent = JSON.stringify(report, null, 2);
  canvas.dataset.ready = "true";
  return report;
}

/** Shadow darkening mass and centroid, pixel-exact against smooth, at one zoom. */
function shadowPlacement(zoom: number) {
  const previous = view.zoom;
  view.zoom = zoom;
  try {
    const base = render({ shadows: false }).pixels;
    const exact = difference(render().pixels, base, 384);
    const smooth = difference(render({ smoothShadows: true }).pixels, base, 384);
    return {
      zoom,
      massRatio: smooth.mass / exact.mass,
      dx: smooth.x - exact.x,
      dy: smooth.y - exact.y,
    };
  } finally {
    view.zoom = previous;
    draw();
  }
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
  async setGrassDetail(zoom: number, fixedProjection = false) {
    if (!sheets.has("grass-blades")) {
      const image = new Image();
      image.src = `${import.meta.env.BASE_URL}assets/sprites/grass-blades.png`;
      await image.decode();
      sheets.set("grass-blades", new Spritesheet(image, 8, 8));
      gpu.addSpriteAssets(sheets);
    }
    const chunk = new Chunk();
    chunk.autotileComputed = true;
    chunk.blendBase.fill(TerrainId.Grass);
    const camera = new Camera();
    camera.snapTo(128, 128);
    camera.setViewport(view.viewportWidth, view.viewportHeight);
    camera.zoom = zoom;
    // Fixed projection keeps the blades' screen layout while LOD opacity changes.
    Object.assign(view, { x: camera.x, y: camera.y, zoom: fixedProjection ? 1 : zoom });
    const world = {
      getHeightAt: () => 0,
      getRoadAt: () => 0,
      getChunkIfLoaded: (x: number, y: number) => (x === 0 && y === 0 ? chunk : undefined),
    };
    grassItems = collectScene(
      [],
      [],
      world,
      camera,
      camera.getVisibleChunkRange(),
      1,
      { collectElevationItems: () => [] },
      [],
      true,
      undefined,
      grassFrame,
    );
    // Freeze blade rotation; animation is covered by collector tests.
    for (const item of grassItems) if (item.kind === "grass") item.angle = 0;
    grassItems.push(sprite(112, 128, 0), {
      kind: "particle",
      wx: 150,
      wy: 140,
      sortKey: 140,
      z: 0,
      size: 8,
      color: "#f8dd17",
      alpha: 1,
    });
    grassItems.sort((a, b) => a.sortKey - b.sortKey);
    return draw();
  },
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
  shadowPlacement,
  /** Expected-color counts of the last drawn frame (see `RendererLabChecks`). */
  palette: (colors: readonly string[], tolerance?: number) =>
    paletteCounts(frame, 384, colors, tolerance),
  histogram: (min?: number) => histogram(frame, min),
  /** FNV-1a of the last frame, to compare whole frames across steps. */
  digest() {
    let hash = 0x811c9dc5;
    for (const value of frame) hash = Math.imul(hash ^ value, 0x01000193);
    return (hash >>> 0).toString(16);
  },
  /** A disabled mesh body must draw exactly the plain sprite car. */
  spriteFallbackMatches() {
    const fallback = frame;
    const plain = render({ meshlessCar: true }).pixels;
    draw();
    return fallback.every((value, i) => value === plain[i]);
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
    grassFrame.clear();
    gpu.dispose();
  },
  gpu,
  /** Publishes an in-place change to a raster source (page re-upload checks). */
  touchRaster,
  probeSpriteSeams,
  probeCameraStability,
  probeWorldRegistration,
  probeTerrainRasterCompletion,
  probeVehicleDepth,
  probeSurfaceDecals,
  probeDeferredShadows,
  probeViewRegions,
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

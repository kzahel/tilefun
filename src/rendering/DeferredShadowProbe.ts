import { Spritesheet } from "../assets/Spritesheet.js";
import { createPlayer } from "../entities/Player.js";
import { surfaceProp } from "../scenarios/WorldGeometryRecipe.js";
import { Camera } from "./Camera.js";
import { GpuRenderBackend } from "./GpuRenderBackend.js";
import { surfaceDecals } from "./ProjectedDecals.js";
import { presentSurfaceScene } from "./presentSurfaceScene.js";
import { SceneFrame } from "./SceneFrame.js";
import type { SceneItem, SpriteItem } from "./SceneItem.js";
import { rectangle, SurfaceReceivers } from "./SurfaceReceivers.js";

/** Pixels each path shades against the baseline, and where the two paths disagree. */
function comparePixels(
  baseline: Uint8ClampedArray,
  projected: Uint8ClampedArray,
  deferred: Uint8ClampedArray,
) {
  const largest = (a: Uint8ClampedArray, b: Uint8ClampedArray, i: number) =>
    Math.max(
      Math.abs((a[i] ?? 0) - (b[i] ?? 0)),
      Math.abs((a[i + 1] ?? 0) - (b[i + 1] ?? 0)),
      Math.abs((a[i + 2] ?? 0) - (b[i + 2] ?? 0)),
    );
  let shadedProjected = 0,
    shadedDeferred = 0,
    differing = 0,
    maxDifference = 0;
  for (let i = 0; i < baseline.length; i += 4) {
    const d = largest(projected, deferred, i);
    if (largest(projected, baseline, i) > 2) shadedProjected++;
    if (largest(deferred, baseline, i) > 2) shadedDeferred++;
    if (d > 12) differing++;
    maxDifference = Math.max(maxDifference, d);
  }
  return { shadedProjected, shadedDeferred, differing, maxDifference };
}

/** The same oval shadow drawn two ways over one ramp/deck fixture (236): the
 * projected CPU decals and the GPU depth pass. Reports how far their pixels
 * differ, per case and zoom. Pixel reads exist only in this diagnostic. */
export async function probeDeferredShadows() {
  const width = 256,
    height = 192,
    canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const gpu = new GpuRenderBackend(canvas);
  gpu.worldRaster = true;
  gpu.surface.enableWorldComposition();
  const frame = new SceneFrame(),
    world = { getHeightAt: () => 0, getChunkIfLoaded: () => undefined, getRoadAt: () => 0 };
  const observer = createPlayer(32, 0);
  observer.wz = 80;
  const readback = document.createElement("canvas");
  readback.width = width;
  readback.height = height;
  const read = readback.getContext("2d", { willReadFrequently: true });
  if (!read) throw Error("Probe readback unavailable");
  const ramp = surfaceProp(
    { left: 0, right: 64, top: -32, bottom: 32 },
    { id: "ramp", spaceId: "upper", z: 0, riseX: 32, riseY: 0, thickness: 4, connectsTo: ["deck"] },
  );
  const deck = surfaceProp(
    { left: 64, right: 112, top: -32, bottom: 32 },
    { id: "deck", spaceId: "upper", z: 32, riseX: 0, riseY: 0, thickness: 4, connectsTo: ["ramp"] },
  );
  const props = [ramp, deck];
  const image = (color?: string) => {
    const sheet = document.createElement("canvas");
    sheet.width = sheet.height = 32;
    const c = sheet.getContext("2d");
    if (!c) throw Error("Probe sprite unavailable");
    if (color) {
      c.fillStyle = color;
      c.fillRect(0, 0, 32, 32);
    }
    return new Spritesheet(sheet, 32, 32);
  };
  gpu.setAssets(
    new Map([
      ["blocker", image("#2277cc")],
      ["blank", image()],
    ]),
  );
  const sprite = (sheetKey: string, wx: number, wy: number, zOffset: number): SpriteItem => ({
    kind: "sprite",
    sortKey: wy + zOffset,
    wx,
    wy,
    zOffset,
    sheetKey,
    frameCol: 0,
    frameRow: 0,
    spriteWidth: 32,
    spriteHeight: 32,
    flipX: false,
    drawOffsetY: 0,
    hasShadow: false,
    shadowFeetWy: wy,
    shadowWidth: 0,
    shadowTerrainZ: 0,
    flashHidden: false,
  });
  const report = [];
  try {
    const receivers = new SurfaceReceivers(world, props, []);
    {
      // The first request attaches sampleable depth for the following frames.
      const camera = new Camera();
      camera.setViewport(width, height);
      camera.worldRaster = true;
      const first = sprite("blank", 0, 0, 0);
      first.gpuShadow = { x: 0, y: 0, rx: 4, ry: 4, z: 0 };
      gpu.beginFrame();
      presentSurfaceScene(gpu, camera, frame, [first], props, observer, "all", 1);
      gpu.presentWorld(0, 0);
    }
    for (const zoom of [1 / 3, 0.5, 2 / 3]) {
      const camera = new Camera();
      camera.setViewport(width, height);
      camera.zoom = zoom;
      camera.worldRaster = true;
      camera.snapTo(26, -8);
      const pixels = (items: SceneItem[]) => {
        gpu.beginFrame();
        gpu.submit(camera, { kind: "clear", color: "#cbd5c3" });
        presentSurfaceScene(gpu, camera, frame, items, props, observer, "all", 1);
        gpu.presentWorld(0, 0);
        read.clearRect(0, 0, width, height);
        read.drawImage(canvas, 0, 0);
        return read.getImageData(0, 0, width, height).data;
      };
      for (const [name, x, y, z, blocker] of [
        ["flat", -20, 0, 0, undefined],
        ["airborne", -20, 0, 20, undefined],
        ["ramp", 32, 0, 16, undefined],
        ["crest", 64, 0, 32, undefined],
        ["deck", 82, 0, 32, undefined],
        ["under-deck", 82, 0, 0, undefined],
        // A solid body standing in the footprint keeps its pixels in both paths.
        ["behind-body", -20, 0, 0, sprite("blocker", -20, 4, 0)],
      ] as const) {
        const rx = 14,
          ry = 8,
          extra = blocker ? [blocker] : [];
        const decals = surfaceDecals(
          receivers.project(
            rectangle({ left: x - rx, right: x + rx, top: y - ry, bottom: y + ry }),
            z,
          ),
          "oval",
          0.28,
        );
        const caster = sprite("blank", x, y, z);
        caster.gpuShadow = { x, y, rx, ry, z: receivers.hit(x, y, z + 1)?.point[2] ?? 0 };
        const baseline = pixels(extra),
          projected = pixels([...decals, ...extra]),
          deferred = pixels([caster, ...extra]);
        const difference = comparePixels(baseline, projected, deferred);
        report.push({ name, zoom, queued: gpu.deferredShadowsDrawn, ...difference });
      }
    }
    return report;
  } finally {
    gpu.dispose();
    frame.clear();
  }
}

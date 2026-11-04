import { Spritesheet } from "../assets/Spritesheet.js";
import { createPlayer } from "../entities/Player.js";
import { surfaceProp } from "../scenarios/WorldGeometryRecipe.js";
import { createVehicle } from "../traffic/Vehicle.js";
import { Camera } from "./Camera.js";
import { collectScene } from "./collectScene.js";
import { GpuRenderBackend } from "./GpuRenderBackend.js";
import { poseOrientation } from "./MeshPresentation.js";
import { projectShadow, surfaceDecals } from "./ProjectedDecals.js";
import { projectWorld } from "./Projection.js";
import { presentSurfaceScene } from "./presentSurfaceScene.js";
import { SceneFrame } from "./SceneFrame.js";
import type { SceneItem, SpriteItem } from "./SceneItem.js";
import { rectangle, SurfaceReceivers } from "./SurfaceReceivers.js";

/** Actual cached world overlays, body images and late decals. Pixel reads exist
 * only in this diagnostic; production receiver geometry is retained plain data. */
export async function probeSurfaceDecals() {
  const width = 256,
    height = 192,
    canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const gpu = new GpuRenderBackend(canvas);
  gpu.worldRaster = true;
  gpu.surface.enableWorldComposition();
  gpu.meshes.setEnabled(true);
  const camera = new Camera();
  camera.setViewport(width, height);
  camera.zoom = 1 / 3;
  camera.worldRaster = true;
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
  const pixels = (items: SceneItem[], props = [ramp, deck], overlay = false) => {
    gpu.beginFrame();
    gpu.submit(camera, { kind: "clear", color: "#cbd5c3" });
    presentSurfaceScene(gpu, camera, frame, items, props, observer, "all", 1);
    if (overlay) {
      frame.overlays.begin();
      frame.overlays.rect(width / 2, height / 2, 8, 8, "#ff00aa");
      gpu.submit(camera, { kind: "overlay", items: frame.overlays.items });
    }
    gpu.surface.presentWorld(0, 0);
    read.clearRect(0, 0, width, height);
    read.drawImage(canvas, 0, 0);
    return read.getImageData(0, 0, width, height).data;
  };
  const sample = (p: Uint8ClampedArray, x: number, y: number, z: number) => {
    const s = projectWorld(camera, x, y, z),
      i = (Math.floor(s.sy) * width + Math.floor(s.sx)) * 4;
    return [p[i] ?? 0, p[i + 1] ?? 0, p[i + 2] ?? 0];
  };
  const report = [];
  try {
    const receivers = new SurfaceReceivers(world, [ramp, deck], []);
    for (const [name, left, right, feet, points] of [
      [
        "ramp",
        16,
        48,
        16,
        [
          [22, 1.5, 11],
          [42, -1.5, 21],
        ],
      ],
      [
        "crest",
        56,
        72,
        32,
        [
          [60, 1.5, 30],
          [64, 1.5, 32],
          [68, 1.5, 32],
        ],
      ],
      [
        "under",
        56,
        72,
        0,
        [
          [60, 1.5, 30],
          [68, 1.5, 32],
        ],
      ],
    ] as const) {
      const footprint = rectangle({ left, right, top: -8, bottom: 8 });
      const decals = surfaceDecals(receivers.project(footprint, feet), "oval", 0.28);
      const baseline = pixels([]),
        shadowed = pixels(decals);
      report.push({
        name,
        receivers: decals.map((d) => d.receiverId),
        samples: points.map(([x, y, z]) => ({
          baseline: sample(baseline, x, y, z),
          shadowed: sample(shadowed, x, y, z),
        })),
      });
    }
    const crestCar = createVehicle("compact-1", 60, 0);
    crestCar.id = 99;
    crestCar.wz = 20;
    crestCar.bodyRotation = poseOrientation(0, -0.3, 0.1);
    const carDecals = surfaceDecals(
      projectShadow(receivers, crestCar, 60, 0, 20, {
        min: [-20, -10, 0],
        max: [20, 10, 20],
        triangles: [],
      }),
      "vehicle",
      0.28,
    );
    const crestBefore = pixels([]),
      crestAfter = pixels(carDecals);
    report.push({
      name: "tilted-car-crest",
      receivers: carDecals.map((d) => d.receiverId),
      samples: [
        [56, 1.5, 28],
        [64, 1.5, 32],
        [68, 1.5, 32],
      ].map(([x = 0, y = 0, z = 0]) => ({
        baseline: sample(crestBefore, x, y, z),
        shadowed: sample(crestAfter, x, y, z),
      })),
    });
    // A solid sprite in front must retain its blue pixels, despite late shadow submission.
    const image = document.createElement("canvas");
    image.width = image.height = 32;
    const c = image.getContext("2d");
    if (!c) throw Error("Probe sprite unavailable");
    c.fillStyle = "#2277cc";
    c.fillRect(0, 0, 32, 32);
    gpu.setAssets(new Map([["probe", new Spritesheet(image, 32, 32)]]));
    const sprite: SpriteItem = {
      kind: "sprite",
      sortKey: 0,
      wx: 0,
      wy: 0,
      zOffset: 0,
      sheetKey: "probe",
      frameCol: 0,
      frameRow: 0,
      spriteWidth: 32,
      spriteHeight: 32,
      flipX: false,
      drawOffsetY: 0,
      hasShadow: false,
      shadowFeetWy: 0,
      shadowWidth: 0,
      shadowTerrainZ: 0,
      flashHidden: false,
    };
    const floor = new SurfaceReceivers(world, [], []),
      decals = surfaceDecals(
        floor.project(rectangle({ left: -20, right: 20, top: -12, bottom: 12 }), 0),
        "oval",
        0.28,
      );
    const baseline = pixels([sprite], []),
      shadowed = pixels([...decals, sprite], []);
    let protectedPixels = 0,
      occlusionErrors = 0;
    for (let i = 0; i < baseline.length; i += 4)
      if (baseline[i] === 34 && baseline[i + 1] === 119 && baseline[i + 2] === 204) {
        protectedPixels++;
        if (
          shadowed[i] !== baseline[i] ||
          shadowed[i + 1] !== baseline[i + 1] ||
          shadowed[i + 2] !== baseline[i + 2]
        )
          occlusionErrors++;
      }
    // Actual compact roof geometry, not its taller collision proxy.
    const car = createVehicle("compact-1", 0, 0);
    car.id = 7;
    car.wz = 0;
    car.bodyRotation = [0, 0, 0, 1];
    let body: SpriteItem | undefined;
    for (let i = 0; i < 1000; i++) {
      const items = collectScene(
        [car],
        [],
        world,
        camera,
        camera.getVisibleChunkRange(),
        1,
        gpu,
        [],
        false,
        undefined,
        undefined,
        frame,
      );
      body = items.find((item): item is SpriteItem => item.kind === "sprite");
      pixels(body ? [{ ...body, hasShadow: false }] : [], []);
      if (gpu.meshes.ready.has("compact-1-authored-v7")) break;
      if (i === 999) throw Error("Roof mesh did not load");
      await new Promise((r) => setTimeout(r, 10));
    }
    if (!body) throw Error("Missing compact body");
    const roof = new SurfaceReceivers(world, [], [car], 1, {
        mesh: gpu.meshSurfaceGeometry.bind(gpu),
      }),
      hit = roof.hit(0, 0, 24);
    if (!hit) throw Error("Missing native roof receiver");
    const roofDecals = surfaceDecals(
      roof.project(rectangle({ left: -8, right: 8, top: -6, bottom: 6 }), 24, 1),
      "oval",
      0.28,
    );
    const roofBefore = pixels([{ ...body, hasShadow: false }], []),
      roofAfter = pixels([{ ...body, hasShadow: false }, ...roofDecals], []);
    const roofSample = {
      height: hit.point[2],
      baseline: sample(roofBefore, 0, 0, hit.point[2]),
      shadowed: sample(roofAfter, 0, 0, hit.point[2]),
    };
    const overlaySample = sample(pixels(decals, [], true), 2, 2, 0);
    const fallbackDecals = surfaceDecals(
      floor.project(rectangle({ left: -20, right: 20, top: -12, bottom: 12 }), 0),
      "vehicle",
      0.28,
      "#000",
      "compact-1-authored-v7",
      123,
    );
    const fallbackBefore = pixels([sprite], []),
      fallbackAfter = pixels([sprite, ...fallbackDecals], []);
    let fallbackShadowErrors = 0;
    for (let i = 0; i < fallbackBefore.length; i++)
      if (fallbackBefore[i] !== fallbackAfter[i]) fallbackShadowErrors++;
    return {
      report,
      protectedPixels,
      occlusionErrors,
      roof: roofSample,
      overlaySample,
      fallbackShadowErrors,
    };
  } finally {
    gpu.dispose();
    frame.clear();
  }
}

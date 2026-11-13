import { expect, it } from "vitest";
import { createPlayer } from "../entities/Player.js";
import { createVehicle } from "../traffic/Vehicle.js";
import { Camera } from "./Camera.js";
import { drawSceneEntry2D } from "./Canvas2DRenderer.js";
import { collectScene } from "./collectScene.js";
import type { GpuShadow } from "./GpuShadowShape.js";
import type { RasterSurface } from "./RasterSurface.js";
import type { SpriteItem } from "./SceneItem.js";
import type { TerrainPresentation } from "./TerrainPresentation.js";

const shape = (casterId?: number): GpuShadow => ({
  x: 0,
  y: 0,
  ux: 8,
  uy: 0,
  vx: 0,
  vy: 4,
  plane: [0, 0, 4],
  band: 8,
  support: 0,
  mask: casterId === undefined ? "oval" : "vehicle",
  ...(casterId === undefined ? {} : { casterId }),
});
const sprite = (extra: Partial<SpriteItem> = {}): SpriteItem => ({
  kind: "sprite",
  sortKey: 0,
  wx: 0,
  wy: 0,
  zOffset: 0,
  sheetKey: "missing",
  frameCol: 0,
  frameRow: 0,
  spriteWidth: 16,
  spriteHeight: 16,
  flipX: false,
  drawOffsetY: 0,
  hasShadow: false,
  shadowFeetWy: 0,
  shadowWidth: 12,
  shadowTerrainZ: 0,
  flashHidden: false,
  ...extra,
});
/** A sink that records shadow submissions; the missing sheet draws no body. */
function sink(accepts: boolean, meshReady: string[] = []) {
  const queued: { shadow: GpuShadow; gate: number | undefined }[] = [];
  const plain: number[] = [];
  const ctx = {
    meshReady: new Set(meshReady),
    setDepthPlane: () => {},
    fillShadow: (x: number) => plain.push(x),
    deferredShadow: (_camera: Camera, shadow: GpuShadow, gate?: number) => {
      if (accepts) queued.push({ shadow, gate });
      return accepts;
    },
  } as unknown as RasterSurface;
  return { ctx, queued, plain };
}
const camera = new Camera();
camera.setViewport(320, 200);

it("queues a body's shadow and those of its towed car and bed contents, gated on the body", () => {
  const towed = sprite({ gpuShadow: shape(8) });
  const rider = sprite({ gpuShadow: shape() });
  const truck = sprite({
    gpuShadow: shape(7),
    shadowCasterId: 7,
    towGroup: towed,
    bedGroup: { heading: 0, contents: [rider] },
  });
  const { ctx, queued, plain } = sink(true);
  drawSceneEntry2D(ctx, camera, truck, new Map(), undefined);
  // The truck's own shadow keeps its default gate (its casterId); grouped
  // children are drawn by the truck, so they follow the truck's body.
  expect(queued.map((q) => [q.shadow, q.gate])).toEqual([
    [truck.gpuShadow, undefined],
    [towed.gpuShadow, 7],
    [rider.gpuShadow, 7],
  ]);
  expect(plain).toEqual([]);
});

it("draws the plain ground shadow when the sink has no depth pass", () => {
  const actor = sink(false);
  drawSceneEntry2D(actor.ctx, camera, sprite({ gpuShadow: shape() }), new Map(), undefined);
  expect(actor.plain).toHaveLength(1);
  // A mesh vehicle falls back only while its mesh is the body being drawn.
  const car = sprite({
    gpuShadow: shape(7),
    meshGroundShadow: true,
    mesh: { assetId: "car", orientation: [0, 0, 0, 1], radius: 24 },
  });
  const ready = sink(false, ["car"]);
  drawSceneEntry2D(ready.ctx, camera, car, new Map(), undefined);
  expect(ready.plain).toHaveLength(1);
  const loading = sink(false);
  drawSceneEntry2D(loading.ctx, camera, car, new Map(), undefined);
  expect(loading.plain).toHaveLength(0);
});

it("keeps a roof rider's shadow on the roof in the overview, where no receivers exist", () => {
  const car = createVehicle("compact-1", 200, 150);
  car.id = 1;
  car.wz = 0;
  const rider = createPlayer(200, 150);
  rider.id = 2;
  rider.wz = car.collider?.physicalHeight ?? 24;
  const world = { getHeightAt: () => 0, getChunkIfLoaded: () => undefined, getRoadAt: () => 0 };
  const terrain = { collectElevationItems: () => [] } as unknown as TerrainPresentation;
  const planeAt = (zoom: number) => {
    const view = new Camera();
    view.setViewport(800, 600);
    view.zoom = zoom;
    view.snapTo(200, 150);
    view.worldRaster = true;
    const items = collectScene(
      [car, rider],
      [],
      world,
      view,
      view.getVisibleChunkRange(),
      1,
      terrain,
      [],
      false,
    );
    const item = items.find(
      (i): i is SpriteItem => i.kind === "sprite" && i.gpuShadow?.mask === "oval",
    );
    return item?.gpuShadow?.plane[2];
  };
  // With receivers (0.25) the roof is found by query; without them (0.1) by roof support.
  expect(planeAt(0.25)).toBeGreaterThan(rider.wz);
  expect(planeAt(0.1)).toBe(planeAt(0.25));
});

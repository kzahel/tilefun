import { describe, expect, it } from "vitest";
import { Camera } from "./Camera.js";
import { layoutViews, type RenderRegion } from "./ViewLayout.js";
import {
  WORLD_RASTER_PAD,
  type WorldComposite,
  WorldRasterFrame,
  worldComposite,
  worldRasterOffset,
} from "./WorldRasterFrame.js";

it("scopes the aligned world frame and restores continuous picking before HUD", () => {
  const camera = new Camera(),
    frame = new WorldRasterFrame();
  camera.setViewport(385, 289);
  camera.snapTo(-128.13, -128.29);
  const before = camera.screenToWorld(12.3, 45.6);
  const expected = worldRasterOffset(camera);
  frame.begin(camera);
  expect(camera.pixelSnap).toBe(true);
  expect(camera.worldRaster).toBe(true);
  expect(() => frame.begin(camera)).toThrow("already active");
  expect(frame.end()).toEqual(expected);
  expect(camera.pixelSnap).toBe(false);
  expect(camera.worldRaster).toBe(false);
  expect(camera.screenToWorld(12.3, 45.6)).toEqual(before);
  expect(frame.end()).toBeUndefined();
});

it("retains the explicit snapped comparison and admits offscreen guard chunks only inside the world scope", () => {
  const camera = new Camera(),
    frame = new WorldRasterFrame();
  camera.pixelSnap = true;
  camera.zoom = 1 / 3;
  camera.setViewport(256, 256);
  camera.snapTo(128, 128);
  const range = camera.getVisibleChunkRange();
  frame.begin(camera);
  expect(camera.getVisibleChunkRange().minCx).toBe(-1);
  expect(frame.end()).toEqual({ x: 0, y: 0 });
  expect(camera.pixelSnap).toBe(true);
  expect(camera.getVisibleChunkRange()).toEqual(range);
});

describe("world composite into a view region", () => {
  const canvas = { width: 1281, height: 801 };
  const target = canvas.height + WORLD_RASTER_PAD * 2;
  /** The world-target pixel (top-down) the shader samples for a region-local
   * pixel, following the present shader: (uv * viewport + offset) / targetSize. */
  const sampled = (c: WorldComposite, i: number, j: number) => ({
    x: i + 0.5 + c.offsetX,
    y: target - (c.height - (j + 0.5) + c.offsetY),
  });

  const cases: [string, RenderRegion | undefined][] = [
    ["whole canvas", undefined],
    ...layoutViews("4", 1281, 801).map((v, i): [string, RenderRegion] => [
      `quarter ${i}`,
      v.region,
    ]),
    ...layoutViews("diagonal", 1281, 801).map((v, i): [string, RenderRegion] => [
      `diagonal ${i}`,
      v.region,
    ]),
  ];
  it.each(cases)("%s samples the view drawn in the target's top-left corner", (_name, region) => {
    const out = worldComposite({} as WorldComposite, canvas, target, 0.3, -0.4, region);
    const width = region?.width ?? canvas.width,
      height = region?.height ?? canvas.height;
    for (const [i, j] of [
      [0, 0],
      [width - 1, 0],
      [0, height - 1],
      [width - 1, height - 1],
      [17, 23],
    ] as const)
      expect(sampled(out, i, j)).toEqual({
        x: WORLD_RASTER_PAD + i + 0.5 - 0.3,
        y: expect.closeTo(WORLD_RASTER_PAD + j + 0.5 + 0.4, 9),
      });
    expect([out.width, out.height]).toEqual([width, height]);
    // The GL viewport is the region with rows counted from the bottom.
    const r = region ?? { x: 0, y: 0, width, height };
    expect(out.partial).toBe(r.width !== canvas.width || r.height !== canvas.height);
    expect([out.viewportX, out.viewportY]).toEqual([r.x, canvas.height - r.y - r.height]);
  });

  it("keeps exactly the canvas pixels the region's half-plane keeps", () => {
    const out = {} as WorldComposite;
    for (const { region } of layoutViews("diagonal", 1281, 801)) {
      worldComposite(out, canvas, target, 0, 0, region);
      const [a, b, c] = region.mask ?? [0, 0, 1];
      for (let y = 0; y < canvas.height; y += 13)
        for (let x = 0; x < canvas.width; x += 11) {
          const fragX = x + 0.5,
            fragY = canvas.height - (y + 0.5);
          const gl = out.maskX * fragX + out.maskY * fragY + out.maskZ >= 0;
          expect(gl).toBe(a * (x + 0.5) + b * (y + 0.5) + c >= 0);
        }
    }
    worldComposite(out, canvas, target, 0, 0);
    expect(out.maskX * 5 + out.maskY * 7 + out.maskZ).toBe(1);
  });
});

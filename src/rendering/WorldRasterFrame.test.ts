import { expect, it } from "vitest";
import { Camera } from "./Camera.js";
import { WorldRasterFrame, worldRasterOffset } from "./WorldRasterFrame.js";

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

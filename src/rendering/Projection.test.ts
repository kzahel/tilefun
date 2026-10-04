import { expect, it } from "vitest";
import { Camera } from "./Camera.js";
import { projectWorld, unprojectPlane } from "./Projection.js";

it("pins ground, elevated and offset anchors to the existing fixed projection", () => {
  const view = { x: 100, y: 200, zoom: 1, viewportWidth: 800, viewportHeight: 600 };
  expect(projectWorld(view, 100, 200)).toEqual({ sx: 400, sy: 300 });
  // PIXEL_SCALE is 3; elevation is subtracted exactly once.
  expect(projectWorld(view, 110, 220, 8)).toEqual({ sx: 430, sy: 336 });
  expect(projectWorld({ ...view, zoom: 0.5 }, 110, 220, 8)).toEqual({ sx: 415, sy: 318 });
});
it("shares camera projection and inverts on the requested plane without DPR duplication", () => {
  const camera = new Camera();
  camera.x = -10.25;
  camera.y = 17.5;
  camera.zoom = 1.25;
  camera.setViewport(411, 789);
  for (const z of [0, 7, 24]) {
    const point = projectWorld(camera, 31, -47, z);
    expect(camera.worldToScreen(31, -47 - z)).toEqual(point);
    expect(unprojectPlane(camera, point.sx, point.sy, z)).toEqual({ wx: 31, wy: -47 });
  }
});

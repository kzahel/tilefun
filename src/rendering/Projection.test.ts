import { expect, it } from "vitest";
import { Camera } from "./Camera.js";
import { cameraPixelSnap } from "./PresentationSettings.js";
import { projectWorld, unprojectPlane } from "./Projection.js";

it("pins ground, elevated and offset anchors to the existing fixed projection", () => {
  const view = { x: 100, y: 200, zoom: 1, viewportWidth: 800, viewportHeight: 600 };
  expect(projectWorld(view, 100, 200)).toEqual({ sx: 400, sy: 300 });
  // PIXEL_SCALE is 3; elevation is subtracted exactly once.
  expect(projectWorld(view, 110, 220, 8)).toEqual({ sx: 430, sy: 336 });
  expect(projectWorld({ ...view, zoom: 0.5 }, 110, 220, 8)).toEqual({ sx: 415, sy: 318 });
});

it("keeps stationary geometry rigid through subpixel camera travel and fractional zoom", () => {
  for (const zoom of [0.4, 0.5, 0.8, 1, 1.3]) {
    const view = {
      x: -128.13,
      y: 128.29,
      zoom,
      viewportWidth: 411,
      viewportHeight: 789,
      pixelSnap: true,
    };
    const points = [
      [-256, 0, 0],
      [-80.13, 90.29, 7],
      [-16, 32, 24],
    ] as const;
    const start = points.map(([x, y, z]) => projectWorld(view, x, y, z));
    for (const phase of [0.1, 0.3, 0.7, 1.1, 2.3]) {
      const moved = { ...view, x: view.x + phase, y: view.y - phase };
      const origin = projectWorld(view, 0, 0);
      const nextOrigin = projectWorld(moved, 0, 0);
      const dx = nextOrigin.sx - origin.sx,
        dy = nextOrigin.sy - origin.sy;
      expect(Number.isInteger(dx) && Number.isInteger(dy)).toBe(true);
      points.forEach(([x, y, z], i) => {
        const next = projectWorld(moved, x, y, z);
        const first = start[i];
        if (!first) throw Error("Missing projected point");
        expect(next.sx - first.sx).toBeCloseTo(dx, 10);
        expect(next.sy - first.sy).toBeCloseTo(dy, 10);
        expect(Math.floor(next.sx) - Math.floor(first.sx)).toBe(dx);
        expect(Math.floor(next.sy) - Math.floor(first.sy)).toBe(dy);
      });
    }
  }
});

it("picks against the displayed snapped projection without quantizing camera follow", () => {
  const camera = new Camera();
  camera.pixelSnap = true;
  camera.zoom = 0.8;
  camera.setViewport(411, 789);
  camera.snapTo(-10.25, 17.5);
  for (const z of [0, 7, 24]) {
    const screen = projectWorld(camera, 31.13, -47.29, z);
    const picked = unprojectPlane(camera, screen.sx, screen.sy, z);
    expect(picked.wx).toBeCloseTo(31.13, 10);
    expect(picked.wy).toBeCloseTo(-47.29, 10);
  }
  expect(camera.x).toBe(-10.25);
  expect(camera.y).toBe(17.5);
  expect(cameraPixelSnap(new URLSearchParams())).toBe(true);
  expect(cameraPixelSnap(new URLSearchParams("pixelsnap=0"))).toBe(false);
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

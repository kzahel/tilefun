import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { CHUNK_SIZE_PX, PIXEL_SCALE } from "../../config/constants.js";
import { projectWorld } from "../Projection.js";
import {
  chunksInRect,
  grown,
  obliqueGround,
  obliqueProjection,
  obliqueScreen,
  squareShows,
} from "./ObliqueCamera.js";

const WIDTH = 1280,
  HEIGHT = 800;

describe("the fixed view's camera on the 3D scene", () => {
  it("puts every point where the fixed view's projection puts it", () => {
    for (const zoom of [1, 0.25, 0.1, 1.3]) {
      const view = { x: 301.4, y: -87.25, zoom, viewportWidth: WIDTH, viewportHeight: HEIGHT };
      const camera = { x: view.x, y: view.y, scale: PIXEL_SCALE * zoom };
      for (const [x, y, z] of [
        [301.4, -87.25, 0],
        [120, 40, 0],
        [505.5, -300, 64],
        [-90, 260.75, 12.5],
      ] as const) {
        const fixed = projectWorld(view, x, y, z);
        const scene = obliqueScreen(camera, WIDTH, HEIGHT, x, y, z);
        expect(scene.sx).toBeCloseTo(fixed.sx, 6);
        expect(scene.sy).toBeCloseTo(fixed.sy, 6);
      }
    }
  });

  it("is the matrix the 3D view's camera uses, in the view's mirrored scene axes", () => {
    const scale = 0.75;
    const camera = new THREE.Camera();
    camera.position.set(40, -70, 0);
    camera.projectionMatrix.fromArray(obliqueProjection(scale, WIDTH, HEIGHT)).transpose();
    camera.updateMatrixWorld(true);
    // Game (x, y, z) is scene (x, −y, z).
    const clip = new THREE.Vector3(140, -(70 + 30), 20).project(camera);
    const expected = obliqueScreen({ x: 40, y: 70, scale }, WIDTH, HEIGHT, 140, 70 + 30, 20);
    expect(((clip.x + 1) / 2) * WIDTH).toBeCloseTo(expected.sx, 4);
    expect(((1 - clip.y) / 2) * HEIGHT).toBeCloseTo(expected.sy, 4);
    expect(clip.z).toBeCloseTo(expected.depth, 6);
  });

  it("orders depth along a view ray: farther south and higher up are nearer", () => {
    const camera = { x: 0, y: 0, scale: 3 };
    const depth = (x: number, y: number, z: number) =>
      obliqueScreen(camera, WIDTH, HEIGHT, x, y, z).depth;
    // A wall top at (y 0, z 32) and the ground 32 px north of the wall's foot
    // share a screen point; the wall is in front.
    expect(obliqueScreen(camera, WIDTH, HEIGHT, 0, 0, 32).sy).toBeCloseTo(
      obliqueScreen(camera, WIDTH, HEIGHT, 0, -32, 0).sy,
      6,
    );
    expect(depth(0, 0, 32)).toBeLessThan(depth(0, -32, 0));
    expect(depth(0, 10, 0)).toBeLessThan(depth(0, 0, 0));
    // The nearest and farthest content a view shows stays inside the clip range.
    for (const scale of [3, 0.3, 0.15]) {
      const half = HEIGHT / (2 * scale);
      const far = obliqueScreen({ x: 0, y: 0, scale }, WIDTH, HEIGHT, 0, -half - 500, -64).depth;
      const near = obliqueScreen({ x: 0, y: 0, scale }, WIDTH, HEIGHT, 0, half + 600, 400).depth;
      expect(far).toBeLessThan(1);
      expect(near).toBeGreaterThan(-1);
    }
  });

  it("lets three.js cull against it: on screen is kept, far off screen is not", () => {
    const scale = 0.75;
    const camera = new THREE.Camera();
    camera.position.set(1000, -2000, 0);
    camera.projectionMatrix.fromArray(obliqueProjection(scale, WIDTH, HEIGHT)).transpose();
    camera.updateMatrixWorld(true);
    const frustum = new THREE.Frustum().setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
    );
    const sphere = (x: number, y: number, z: number) =>
      frustum.intersectsSphere(new THREE.Sphere(new THREE.Vector3(x, -y, z), 16));
    const halfWidth = WIDTH / (2 * scale),
      halfHeight = HEIGHT / (2 * scale);
    expect(sphere(1000, 2000, 0)).toBe(true);
    expect(sphere(1000 + halfWidth - 20, 2000 - halfHeight + 20, 0)).toBe(true);
    // A tall thing south of the bottom edge stands up into the view.
    expect(sphere(1000, 2000 + halfHeight + 100, 150)).toBe(true);
    expect(sphere(1000, 2000 + halfHeight + 100, 0)).toBe(false);
    expect(sphere(1000 + halfWidth + 100, 2000, 0)).toBe(false);
    expect(sphere(1000, 2000 - halfHeight - 100, 0)).toBe(false);
  });

  it("shows the fixed camera's ground rectangle", () => {
    const ground = obliqueGround({ x: 100, y: 50, scale: 2 }, 400, 200);
    expect(ground).toEqual({ left: 0, right: 200, top: 0, bottom: 100 });
    expect(grown(ground, 10, 40)).toEqual({ left: -10, right: 210, top: -10, bottom: 140 });
  });

  it("lists the chunks that touch a rectangle, nearest its centre first", () => {
    const size = CHUNK_SIZE_PX;
    const chunks = chunksInRect({
      left: -1,
      right: size + 1,
      top: size * 0.25,
      bottom: size * 0.75,
    });
    expect(chunks.map((c) => c.key).sort()).toEqual(["-1,0", "0,0", "1,0"]);
    expect(chunks[0]?.key).toBe("0,0");
    expect(chunks[0]?.distance).toBe(0);
    expect(chunks[2]?.distance).toBeCloseTo(size / 2, 6);
  });

  it("tells which screen squares touch the view: a raised point shows farther south", () => {
    const ground = obliqueGround({ x: 100, y: 50, scale: 2 }, 400, 200);
    // Ground on screen: x 0…200, y 0…100.
    const at = (wx: number, wy: number, zOffset = 0) => ({ wx, wy, zOffset });
    expect(squareShows(ground, at(100, 50), 8)).toBe(true);
    expect(squareShows(ground, at(-7, 50), 8)).toBe(true);
    expect(squareShows(ground, at(-8, 50), 8)).toBe(false);
    expect(squareShows(ground, at(208, 50), 8)).toBe(false);
    expect(squareShows(ground, at(100, -8), 8)).toBe(false);
    expect(squareShows(ground, at(100, 108), 8)).toBe(false);
    // 30 pixels up, a point 30 south of the bottom edge is drawn on the edge.
    expect(squareShows(ground, at(100, 130, 30), 8)).toBe(true);
    expect(squareShows(ground, at(100, 20, 30), 8)).toBe(false);
  });
});

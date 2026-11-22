import * as THREE from "three";
import { expect, it } from "vitest";
import { setCarMeshProjection } from "./CarMeshProjection.js";
import { obliqueScreen } from "./firstperson/ObliqueCamera.js";
import { poseOrientation } from "./MeshPresentation.js";
import { projectWorld } from "./Projection.js";

it("projects rotated model vertices through the same fixed world mapping at every heading", () => {
  const radius = 64;
  const matrix = new THREE.Matrix4();
  setCarMeshProjection(matrix, radius);
  const anchor = { x: 170, y: -90, z: 12 };
  for (const zoom of [0.5, 1, 1.75]) {
    const view = { x: 120, y: -75, zoom, viewportWidth: 900, viewportHeight: 600, pixelSnap: true };
    const origin = projectWorld(view, anchor.x, anchor.y, anchor.z);
    const scale = projectWorld(view, anchor.x + 1, anchor.y, anchor.z).sx - origin.sx;
    for (let yaw = -Math.PI; yaw <= Math.PI; yaw += Math.PI / 8) {
      const rotation = new THREE.Quaternion(...poseOrientation(yaw, 0.2, -0.1));
      for (const point of [
        [0, 0, 0],
        [31, 0, 0],
        [0, 13, 0],
        [0, 0, 24],
        [-20, -10, 6],
      ] as const) {
        const local = new THREE.Vector3(...point).applyQuaternion(rotation);
        const projected = local.clone().applyMatrix4(matrix);
        const world = projectWorld(
          view,
          anchor.x + local.x,
          anchor.y + local.y,
          anchor.z + local.z,
        );
        expect(origin.sx + projected.x * radius * scale).toBeCloseTo(world.sx);
        expect(origin.sy - projected.y * radius * scale).toBeCloseTo(world.sy);
      }
    }
  }
});

it("keeps a car's ground-forward screen angle aligned with world movement, including diagonals", () => {
  const matrix = new THREE.Matrix4();
  setCarMeshProjection(matrix, 64);
  for (let yaw = -Math.PI; yaw < Math.PI; yaw += Math.PI / 16) {
    const forward = new THREE.Vector3(1, 0, 0)
      .applyQuaternion(new THREE.Quaternion(...poseOrientation(yaw)))
      .applyMatrix4(matrix);
    const error = Math.atan2(
      Math.sin(Math.atan2(-forward.y, forward.x) - yaw),
      Math.cos(Math.atan2(-forward.y, forward.x) - yaw),
    );
    expect(error).toBeCloseTo(0);
  }
  expect(matrix.determinant()).not.toBe(0);
});

it("keeps a level boom the same screen length as it slews, even when the pivot is elevated", () => {
  const length = 120;
  const radius = 240;
  const width = 900;
  const height = 600;
  const camera = { x: -24, y: 12, scale: 2 };
  const matrix = new THREE.Matrix4();
  setCarMeshProjection(matrix, radius);

  for (const z of [0, 40, 120]) {
    const pivot = new THREE.Vector3(-20, 5, z);
    const start = obliqueScreen(camera, width, height, ...pivot.toArray());
    const imageStart = pivot.clone().applyMatrix4(matrix);
    for (let degrees = 0; degrees < 360; degrees += 5) {
      const yaw = (degrees * Math.PI) / 180;
      const tip = new THREE.Vector3(length * Math.cos(yaw), length * Math.sin(yaw), 0).add(pivot);
      const end = obliqueScreen(camera, width, height, ...tip.toArray());
      const imageEnd = tip.clone().applyMatrix4(matrix);
      expect(Math.hypot(end.sx - start.sx, end.sy - start.sy)).toBeCloseTo(length * camera.scale);
      expect(Math.hypot(imageEnd.x - imageStart.x, imageEnd.y - imageStart.y) * radius).toBeCloseTo(
        length,
      );
    }
  }
});

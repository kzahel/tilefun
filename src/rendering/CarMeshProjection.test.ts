import * as THREE from "three";
import { expect, it } from "vitest";
import setup from "../../scripts/authored-assets/compact-final-setup.json" with { type: "json" };
import { setCarMeshProjection } from "./CarMeshProjection.js";
import { poseOrientation, yawOrientation } from "./MeshPresentation.js";

it("matches retained side and front camera metrics without moving the ground anchor", () => {
  for (const [yaw, camera] of [
    [0, setup.cameras.east],
    [Math.PI, setup.cameras.west],
    [-Math.PI / 2, setup.cameras.north],
    [Math.PI / 2, setup.cameras.south],
  ] as const) {
    const matrix = new THREE.Matrix4();
    const radius = 64;
    setCarMeshProjection(matrix, radius, yawOrientation(yaw));
    const screen = (point: THREE.Vector3) => point.applyMatrix4(matrix).multiplyScalar(radius);
    expect(screen(new THREE.Vector3()).length()).toBe(0);
    expect(screen(new THREE.Vector3(10, 0, 0)).x).toBeCloseTo(10 * camera.horizontalScale);
    const elevation = (camera.elevation * Math.PI) / 180;
    const verticalScale = camera.horizontalScale * camera.verticalStretch;
    expect(screen(new THREE.Vector3(0, 10, 0)).y).toBeCloseTo(
      -10 * verticalScale * Math.sin(elevation),
    );
    expect(screen(new THREE.Vector3(0, 0, 10)).y).toBeCloseTo(
      10 * verticalScale * Math.cos(elevation),
    );
  }
});

it("keeps camera metrics continuous at sprite heading boundaries and through pitched turns", () => {
  const matrix = (yaw: number, pitch = 0) => {
    const value = new THREE.Matrix4();
    setCarMeshProjection(value, 64, poseOrientation(yaw, pitch));
    return value;
  };
  for (let yaw = -Math.PI; yaw <= Math.PI; yaw += Math.PI / 4) {
    const before = matrix(yaw - 1e-6).elements;
    const after = matrix(yaw + 1e-6).elements;
    expect(Math.max(...before.map((value, i) => Math.abs(value - (after[i] ?? 0))))).toBeLessThan(
      1e-7,
    );
    const pitched = matrix(yaw, 0.4).elements;
    matrix(yaw).elements.forEach((value, i) => {
      expect(pitched[i]).toBeCloseTo(value, 10);
    });
  }
  expect(matrix(0, Math.PI / 2).elements.every(Number.isFinite)).toBe(true);
});

import * as THREE from "three";
import { expect, it } from "vitest";
import { meshBedFoot, meshChildPoint, meshGradePoint } from "./MeshGradePose.js";
import { poseOrientation, yawOrientation } from "./MeshPresentation.js";
import type { SpriteItem } from "./SceneItem.js";

it("moves attached feet by the rigid chassis rotation without rotating the upright sprite", () => {
  for (const heading of [0, Math.PI, Math.PI / 2, Math.PI / 4]) {
    const mesh = {
      assetId: "dump-truck-authored-v2",
      radius: 128,
      orientation: yawOrientation(heading),
      gradePitch: 0.24,
      gradeRoll: -0.1,
      gradeOffsetZ: -8,
    };
    const q = new THREE.Quaternion(...poseOrientation(heading, -0.24, -0.1)).multiply(
      new THREE.Quaternion(...yawOrientation(heading)).invert(),
    );
    for (const [x = 0, y = 0, z = 0] of [
      [-20, 3, 21.74],
      [30, -4, 48],
      [-40, 3, 24.65],
    ]) {
      const expected = new THREE.Vector3(x, y, z).applyQuaternion(q);
      expected.z -= 8;
      const point = meshGradePoint(mesh, x, y, z);
      expect(point.x).toBeCloseTo(expected.x, 10);
      expect(point.y).toBeCloseTo(expected.y, 10);
      expect(point.z).toBeCloseTo(expected.z, 10);
      const owner = { wx: 200, wy: 150, zOffset: 100, mesh } as SpriteItem;
      const item = { wx: 200 + x, wy: 150 + y, zOffset: 100 + z } as SpriteItem;
      const physical = {
        x: item.wx - owner.wx,
        y: item.wy - owner.wy,
        z: item.zOffset - owner.zOffset,
      };
      expect(meshBedFoot(owner, item)).toEqual(physical);
      const attached = meshBedFoot(owner, { ...item, meshBedSupport: true });
      expect(attached.x).toBeCloseTo(point.x, 10);
      expect(attached.y).toBeCloseTo(point.y, 10);
      expect(attached.z).toBeCloseTo(point.z, 10);
      // Sprite fallback ignores mesh-only fields and retains physical world feet.
      const fallback = { ...owner };
      delete fallback.mesh;
      expect(meshBedFoot(fallback, { ...item, meshBedSupport: true })).toEqual(physical);
    }
  }
});

it("keeps flat attachment coordinates exact after a previously tilted frame", () => {
  const mesh = { assetId: "dump-truck-authored-v2", radius: 128, orientation: yawOrientation(0.7) };
  expect(meshGradePoint({ ...mesh, gradePitch: 0.2, gradeRoll: 0.1 }, 1, 2, 3)).not.toEqual({
    x: 1,
    y: 2,
    z: 3,
  });
  expect(meshGradePoint(mesh, 1, 2, 3)).toEqual({ x: 1, y: 2, z: 3 });
});

it("composes a child's own lift before the carrier's grade and shares its exact target pivot", () => {
  const mesh = {
    assetId: "tow-truck-authored-v2",
    radius: 144,
    orientation: yawOrientation(0.5),
    gradePitch: 0.2,
    gradeRoll: -0.1,
    gradeOffsetZ: -12,
  };
  const owner = { wx: 200, wy: 150, zOffset: 100, mesh } as SpriteItem;
  const child = {
    wx: 170,
    wy: 20,
    zOffset: 110,
    mesh: {
      assetId: "compact-1-authored-v7",
      radius: 64,
      orientation: yawOrientation(-0.25),
      towOffsetX: -4,
      towOffsetZ: 8,
    },
  } as SpriteItem;
  const q = new THREE.Quaternion(...poseOrientation(0.5, -0.2, -0.1)).multiply(
    new THREE.Quaternion(...yawOrientation(0.5)).invert(),
  );
  const expected = new THREE.Vector3(
    -30 - 4 * Math.cos(-0.25),
    -130 - 4 * Math.sin(-0.25),
    18,
  ).applyQuaternion(q);
  expected.z -= 12;
  const point = meshChildPoint(owner, child);
  expect(point.x).toBeCloseTo(expected.x, 10);
  expect(point.y).toBeCloseTo(expected.y, 10);
  expect(point.z).toBeCloseTo(expected.z, 10);
});

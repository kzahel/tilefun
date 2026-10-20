import * as THREE from "three";
import { expect } from "vitest";
import { required } from "../art/ArtCatalog.js";
import type { CarMeshAsset } from "../rendering/CarMeshAsset.js";

/** Measure real tire vertices and their world-space travel, independently of
 * the runtime's private wheel list. Mixed axle radii must preserve arc length. */
export function verifyOriginalWheelGeometryAndTravel(
  asset: CarMeshAsset,
  expectedRadii: Readonly<Record<string, number>>,
): void {
  const wheelIds = Object.keys(expectedRadii);
  expect(wheelIds.length).toBeGreaterThan(0);
  const referenceRadius = required(expectedRadii[required(wheelIds[0])]);
  asset.object.updateMatrixWorld(true);
  const rolls: string[] = [];
  const fixed: { mesh: THREE.Mesh; matrix: number[] }[] = [];
  asset.object.traverse((node) => {
    if (/^Wheel_.+_Roll$/.test(node.name)) rolls.push(node.name);
    if (!(node instanceof THREE.Mesh)) return;
    let parent: THREE.Object3D | null = node;
    while (parent && !/^Wheel_.+_Roll$/.test(parent.name)) parent = parent.parent;
    if (!parent) fixed.push({ mesh: node, matrix: node.matrixWorld.toArray() });
  });
  expect(rolls.sort()).toEqual(wheelIds.map((id) => `Wheel_${id}_Roll`).sort());
  expect(fixed).toHaveLength(1);
  const samples = wheelIds.map((id) => {
    const roll = required(asset.object.getObjectByName(`Wheel_${id}_Roll`));
    expect(roll.parent?.name).toBe(`Wheel_${id}_Steer`);
    expect(roll.userData.roll_axis_gltf).toEqual([0, 0, -1]);
    expect(roll.userData.wheel_radius).toBeCloseTo(required(expectedRadii[id]), 6);
    const center = roll.getWorldPosition(new THREE.Vector3());
    const axis = new THREE.Vector3(0, 0, -1).transformDirection(roll.matrixWorld);
    const selected: { mesh: THREE.Mesh; vertex: number; world: THREE.Vector3 }[] = [];
    let radius = -Infinity;
    roll.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const positions = node.geometry.getAttribute("position");
      for (let vertex = 0; vertex < positions.count; vertex++) {
        const world = new THREE.Vector3()
          .fromBufferAttribute(positions, vertex)
          .applyMatrix4(node.matrixWorld);
        const radial = world.clone().sub(center).projectOnPlane(axis).length();
        if (radial > radius) {
          radius = radial;
          selected[0] = { mesh: node, vertex, world };
        }
      }
    });
    // This is the decoded tire envelope, not a read-back of radius extras.
    expect(radius, `${id} actual tire radius`).toBeCloseTo(required(expectedRadii[id]), 4);
    return { id, roll, center, axis, rest: roll.quaternion.clone(), sample: required(selected[0]) };
  });
  // A common travel rotates each actual tire by its own independent radius.
  // Every declared axle is measured, moved, reversed and reset with a fixed body.
  for (const travel of [(referenceRadius * Math.PI) / 2, (-referenceRadius * Math.PI) / 2, 0]) {
    asset.setTravel(travel);
    asset.object.updateMatrixWorld(true);
    for (const { id, roll, center, axis, rest, sample } of samples) {
      const actual = new THREE.Vector3()
        .fromBufferAttribute(sample.mesh.geometry.getAttribute("position"), sample.vertex)
        .applyMatrix4(sample.mesh.matrixWorld);
      const expected = sample.world
        .clone()
        .sub(center)
        .applyAxisAngle(axis, -travel / required(expectedRadii[id]))
        .add(center);
      expect(actual.distanceTo(expected), `${id} signed travel ${travel}`).toBeLessThan(0.00001);
      if (travel === 0) expect(roll.quaternion.toArray()).toEqual(rest.toArray());
    }
    for (const { mesh, matrix } of fixed) expect(mesh.matrixWorld.toArray()).toEqual(matrix);
  }
}

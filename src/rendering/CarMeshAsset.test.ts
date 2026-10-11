import * as THREE from "three";
import { expect, it, vi } from "vitest";
import { CarMeshAsset } from "./CarMeshAsset.js";

function fixture() {
  const scene = new THREE.Group();
  const map = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  const material = new THREE.MeshBasicMaterial({ map });
  for (const [i, id] of ["FL", "FR", "RL", "RR"].entries()) {
    const steer = new THREE.Group();
    steer.name = `Wheel_${id}_Steer`;
    steer.position.set(i < 2 ? -17 : 15, 4.1, i % 2 ? 10 : -10);
    const roll = new THREE.Group();
    roll.name = `Wheel_${id}_Roll`;
    roll.userData = { wheel_radius: 4.1, roll_axis_gltf: [0, 0, -1] };
    roll.add(new THREE.Mesh(new THREE.BoxGeometry(8, 8, 2), material));
    steer.add(roll);
    scene.add(steer);
  }
  return { scene, map, material };
}

it("registers GLB axes and fixed lateral width while preserving tire/roof height and ground origin", () => {
  const { scene } = fixture();
  const asset = new CarMeshAsset(scene);
  asset.object.updateMatrixWorld(true);
  const world = (point: readonly [number, number, number]) =>
    scene.localToWorld(new THREE.Vector3(...point)).toArray();
  const close = (actual: number[], expected: number[]) => {
    expected.forEach((v, i) => {
      expect(actual[i]).toBeCloseTo(v);
    });
  };
  // GLB front, vertical and lateral axes become game +X, +Z and ground Y.
  close(world([-31, 0, 0]), [31, 0, 0]);
  close(world([0, 24, 0]), [0, 0, 24]);
  close(world([0, 0, -10]), [0, -13, 0]);
  close(world([0, 0, 0]), [0, 0, 0]);
  asset.object.rotation.z = Math.PI / 2;
  asset.object.updateMatrixWorld(true);
  close(world([-31, 0, 0]), [0, 31, 0]);
  close(world([0, 24, 0]), [0, 0, 24]);
  asset.dispose();
});

it("applies absolute rigid wheel travel without moving pivots, then frees shared resources once", () => {
  const { scene, material, map } = fixture();
  const freeMaterial = vi.spyOn(material, "dispose");
  const freeMap = vi.spyOn(map, "dispose");
  const asset = new CarMeshAsset(scene);
  const roll = scene.getObjectByName("Wheel_FL_Roll");
  if (!roll) throw Error("Missing fixture wheel");
  asset.object.updateMatrixWorld(true);
  const center = roll.getWorldPosition(new THREE.Vector3()).clone();
  // Original +X radial point moves toward +Y after forward quarter roll
  // about local -Z with phase -distance/radius (two negative signs).
  asset.setTravel((Math.PI * 4.1) / 2);
  const radial = new THREE.Vector3(1, 0, 0).applyQuaternion(roll.quaternion);
  expect(radial.x).toBeCloseTo(0);
  expect(radial.y).toBeCloseTo(1);
  expect(roll.getWorldPosition(new THREE.Vector3()).distanceTo(center)).toBeCloseTo(0);
  asset.setTravel(0); // Next car/draw cannot inherit the preceding travel.
  expect(roll.quaternion.toArray()).toEqual([0, 0, 0, 1]);
  asset.setTravel(-(Math.PI * 4.1) / 2);
  expect(new THREE.Vector3(1, 0, 0).applyQuaternion(roll.quaternion).y).toBeCloseTo(-1);
  asset.dispose();
  expect(freeMaterial).toHaveBeenCalledTimes(1);
  expect(freeMap).toHaveBeenCalledTimes(1);
  expect(asset.object.children).toHaveLength(0);
});

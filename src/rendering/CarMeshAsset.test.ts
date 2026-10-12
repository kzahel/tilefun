import * as THREE from "three";
import { expect, it, vi } from "vitest";
import { required } from "../art/ArtCatalog.js";
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

it("compiles body and wheel siblings once, retains tagged light control and disposes every geometry once", () => {
  const { scene, material } = fixture();
  for (const id of ["FL", "FR", "RL", "RR"])
    required(scene.getObjectByName(`Wheel_${id}_Roll`)).add(
      new THREE.Mesh(new THREE.BoxGeometry(), material),
    );
  scene.add(
    new THREE.Mesh(new THREE.BoxGeometry(), material),
    new THREE.Mesh(new THREE.BoxGeometry(), material),
  );
  const lens = new THREE.Mesh(new THREE.BoxGeometry(), material);
  lens.userData = {
    tilefun_effect_schema: 1,
    tilefun_role: "emergency-light",
    tilefun_channel: "emergencyLights",
    tilefun_group: "left",
    tilefun_phase: 0,
  };
  scene.add(lens);
  const geometries = new Set<THREE.BufferGeometry>();
  scene.traverse((node) => {
    if (node instanceof THREE.Mesh) geometries.add(node.geometry);
  });
  const asset = new CarMeshAsset(scene, 1.3, { batch: true });
  expect(asset.meshCount).toBe(11);
  expect(asset.drawMeshCount).toBe(6);
  scene.traverse((node) => {
    if (node instanceof THREE.Mesh) geometries.add(node.geometry);
  });
  const frees = [...geometries].map((geometry) => vi.spyOn(geometry, "dispose"));
  asset.setEmergency(true, 0.05);
  expect((lens.material as THREE.MeshBasicMaterial).color.r).toBe(4);
  asset.setEmergency(false, 0.05);
  expect((lens.material as THREE.MeshBasicMaterial).color.r).toBe(1);
  asset.setTravel(7);
  asset.setTravel(0);
  for (const id of ["FL", "FR", "RL", "RR"])
    expect(required(scene.getObjectByName(`Wheel_${id}_Roll`)).quaternion.toArray()).toEqual([
      0, 0, 0, 1,
    ]);
  asset.dispose();
  asset.dispose();
  for (const free of frees) expect(free).toHaveBeenCalledTimes(1);
});

it("rolls every six-wheel axle by its own radius and resets absolute phases without moving body or pivots", () => {
  const { scene, material } = fixture();
  const body = new THREE.Mesh(new THREE.BoxGeometry(40, 10, 20), material);
  body.name = "Body";
  scene.add(body);
  for (const [i, id] of ["ML", "MR"].entries()) {
    const steer = new THREE.Group();
    steer.name = `Wheel_${id}_Steer`;
    steer.position.set(0, 6.5, i ? 8 : -8);
    const roll = new THREE.Group();
    roll.name = `Wheel_${id}_Roll`;
    roll.userData = { wheel_radius: 6.5, roll_axis_gltf: [0, 0, -1] };
    roll.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.2);
    roll.add(new THREE.Mesh(new THREE.BoxGeometry(13, 13, 2), material));
    steer.add(roll);
    scene.add(steer);
  }
  const rolls = ["FL", "FR", "ML", "MR", "RL", "RR"].map((id) =>
    required(scene.getObjectByName(`Wheel_${id}_Roll`)),
  );
  const rest = rolls.map((node) => node.quaternion.clone());
  const asset = new CarMeshAsset(scene, 1);
  asset.object.updateMatrixWorld(true);
  const centers = rolls.map((node) => node.getWorldPosition(new THREE.Vector3()));
  const bodyRest = body.matrixWorld.clone();
  for (const distance of [12, -12, 0, 7, 0]) {
    asset.setTravel(distance);
    asset.object.updateMatrixWorld(true);
    rolls.forEach((node, i) => {
      const phase = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, -1),
        -distance / node.userData.wheel_radius,
      );
      expect(node.quaternion.angleTo(required(rest[i]).clone().multiply(phase))).toBeLessThan(1e-7);
      expect(
        node.getWorldPosition(new THREE.Vector3()).distanceTo(required(centers[i])),
      ).toBeLessThan(1e-8);
    });
    expect(body.matrixWorld.equals(bodyRest)).toBe(true);
  }
  asset.dispose();
});
it.each(["radius", "parent", "duplicate"])(
  "rejects malformed additional wheel %s and disposes shared resources",
  (fault) => {
    const { scene, material, map } = fixture();
    const roll = required(scene.getObjectByName("Wheel_FL_Roll")).clone();
    roll.name = fault === "duplicate" ? "Wheel_FL_Roll" : "Wheel_ML_Roll";
    roll.userData.wheel_radius = fault === "radius" ? 0 : 6.5;
    const steer = new THREE.Group();
    steer.name = fault === "parent" ? "Wrong" : "Wheel_ML_Steer";
    steer.add(roll);
    scene.add(steer);
    const freeMaterial = vi.spyOn(material, "dispose"),
      freeMap = vi.spyOn(map, "dispose");
    expect(() => new CarMeshAsset(scene)).toThrow(/authored car wheel/);
    expect(freeMaterial).toHaveBeenCalledTimes(1);
    expect(freeMap).toHaveBeenCalledTimes(1);
  },
);

it("keeps source hierarchy by default and fails closed if a qualified batching surface disappears", () => {
  const { scene, material } = fixture();
  const body = new THREE.Mesh(new THREE.BoxGeometry(), material);
  body.name = "Body-panel";
  scene.add(body, new THREE.Mesh(new THREE.BoxGeometry(), material));
  const asset = new CarMeshAsset(scene);
  expect(asset.drawMeshCount).toBe(asset.meshCount);
  expect(scene.getObjectByName("Body-panel")).toBe(body);
  asset.dispose();
  const next = fixture();
  const free = vi.spyOn(next.material, "dispose");
  expect(
    () => new CarMeshAsset(next.scene, 1, { batch: true, preserveParts: ["missing"] }),
  ).toThrow("Missing qualified vehicle part");
  expect(free).toHaveBeenCalledTimes(1);
});

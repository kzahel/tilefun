import * as THREE from "three";
import { expect, it } from "vitest";
import { batchVehicleGeometry } from "./VehicleGeometryBatches.js";

it("preserves literal attributes, triangle order and independently transformed parent groups", () => {
  const scene = new THREE.Group();
  const material = new THREE.MeshBasicMaterial();
  const parents = [new THREE.Group(), new THREE.Group()];
  const original: THREE.BufferGeometry[][] = [];
  for (const [i, parent] of parents.entries()) {
    parent.position.set(i * 10, 5, -3);
    parent.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), i * 0.3);
    scene.add(parent);
    const geometries = [new THREE.BoxGeometry(1, 2, 3), new THREE.BoxGeometry(3, 2, 1)];
    original.push(geometries);
    for (const geometry of geometries) parent.add(new THREE.Mesh(geometry, material));
  }
  const retained: THREE.BufferGeometry[] = [];
  expect(batchVehicleGeometry(scene, (geometry) => retained.push(geometry))).toBe(2);
  expect(retained).toHaveLength(2);
  for (const [i, parent] of parents.entries()) {
    const first = original[i]?.[0],
      second = original[i]?.[1];
    if (!first || !second) throw Error("Missing source geometry");
    const mesh = parent.children[0] as THREE.Mesh;
    expect(mesh.parent).toBe(parent);
    expect(mesh.matrix.equals(new THREE.Matrix4())).toBe(true);
    for (const name of ["position", "normal", "uv"]) {
      const expected = [...first.getAttribute(name).array, ...second.getAttribute(name).array];
      expect([...mesh.geometry.getAttribute(name).array]).toEqual(expected);
    }
    const offset = first.getAttribute("position").count;
    expect([...(mesh.geometry.getIndex()?.array ?? [])]).toEqual([
      ...(first.getIndex()?.array ?? []),
      ...[...(second.getIndex()?.array ?? [])].map((index) => index + offset),
    ]);
    expect(mesh.material).toBe(material);
  }
  parents[0]?.rotateZ(0.7);
  expect(parents[1]?.quaternion.z).toBeCloseTo(Math.sin(0.15));
});

it("keeps tagged effects, distinct draw state, transforms and unsupported geometry untouched", () => {
  const scene = new THREE.Group();
  const material = new THREE.MeshBasicMaterial();
  const make = () => new THREE.Mesh(new THREE.BoxGeometry(), material);
  const pair = [make(), make()];
  scene.add(...pair);
  const protectedMeshes = [make(), make(), make(), make(), make(), make(), make()];
  const [tagged, transformed, layered, partial, morphed, hidden, custom] = protectedMeshes;
  if (!tagged || !transformed || !layered || !partial || !morphed || !hidden || !custom)
    throw Error("Missing fixture");
  tagged.userData.tilefun_role = "emergency-light";
  transformed.position.x = 1;
  layered.layers.set(2);
  partial.geometry.setDrawRange(0, 3);
  morphed.geometry.morphAttributes.position = [morphed.geometry.getAttribute("position").clone()];
  hidden.visible = false;
  custom.onBeforeRender = () => {};
  scene.add(...protectedMeshes);
  const retained: THREE.BufferGeometry[] = [];
  expect(batchVehicleGeometry(scene, (geometry) => retained.push(geometry))).toBe(8);
  expect(retained).toHaveLength(1);
  for (const mesh of protectedMeshes) expect(mesh.parent).toBe(scene);
  expect(pair.every((mesh) => mesh.parent === null)).toBe(true);
});

it("retains qualified raster-sensitive parts while merging their compatible siblings", () => {
  const parent = new THREE.Group(),
    material = new THREE.MeshBasicMaterial();
  const meshes = Array.from({ length: 3 }, (_, i) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
    mesh.name = `part-${i}`;
    parent.add(mesh);
    return mesh;
  });
  expect(batchVehicleGeometry(parent, () => {}, new Set(["part-1"]))).toBe(2);
  expect(meshes[1]?.parent).toBe(parent);
  expect(meshes[0]?.parent).toBeNull();
  expect(meshes[2]?.parent).toBeNull();
});

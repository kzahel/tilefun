// Explicit metadata authoring/check tool. Normal builds use the retained JSON.
import { readFileSync, writeFileSync } from "node:fs";
import * as THREE from "three";
import { AUTHORED_VEHICLE_MESHES } from "../src/rendering/AuthoredVehicleMeshes.js";

const bounds: Record<string, { length: number; breadth: number }> = {};
for (const mesh of AUTHORED_VEHICLE_MESHES) {
  const bytes = readFileSync(`public/${mesh.path}`);
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  const registration = new THREE.Matrix4()
    .makeScale(1, mesh.lateralScale, 1)
    .multiply(
      new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.PI / 2, 0, Math.PI, "ZYX")),
    );
  const result = new THREE.Box3();
  function visit(index: number, parent: THREE.Matrix4) {
    const node = gltf.nodes[index];
    const local = node.matrix
      ? new THREE.Matrix4().fromArray(node.matrix)
      : new THREE.Matrix4().compose(
          new THREE.Vector3(...((node.translation ?? [0, 0, 0]) as [number, number, number])),
          new THREE.Quaternion(
            ...((node.rotation ?? [0, 0, 0, 1]) as [number, number, number, number]),
          ),
          new THREE.Vector3(...((node.scale ?? [1, 1, 1]) as [number, number, number])),
        );
    const matrix = parent.clone().multiply(local);
    if (node.mesh !== undefined)
      for (const primitive of gltf.meshes[node.mesh].primitives) {
        const accessor = gltf.accessors[primitive.attributes.POSITION];
        if (!accessor.min || !accessor.max) throw Error(`Missing bounds: ${mesh.vehicle}`);
        result.union(
          new THREE.Box3(
            new THREE.Vector3(...(accessor.min as [number, number, number])),
            new THREE.Vector3(...(accessor.max as [number, number, number])),
          ).applyMatrix4(matrix),
        );
      }
    for (const child of node.children ?? []) visit(child, matrix);
  }
  for (const index of gltf.scenes[gltf.scene ?? 0].nodes) visit(index, registration);
  bounds[mesh.vehicle] = {
    length: Math.ceil(2 * Math.max(Math.abs(result.min.x), Math.abs(result.max.x)) - 1e-6),
    breadth: Math.ceil(2 * Math.max(Math.abs(result.min.y), Math.abs(result.max.y)) - 1e-6),
  };
}
const path = "src/traffic/vehicle-body-bounds.json";
const json = `${JSON.stringify(Object.fromEntries(Object.entries(bounds).sort(([a], [b]) => a.localeCompare(b))), null, 2)}\n`;
if (process.argv.includes("--check")) {
  if (readFileSync(path, "utf8") !== json)
    throw Error("Vehicle body bounds are stale; run npx tsx scripts/vehicle-body-bounds.ts");
} else writeFileSync(path, json);
console.log(`Verified ${Object.keys(bounds).length} retained vehicle mesh envelopes.`);

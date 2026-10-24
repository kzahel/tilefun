/** Explicit, read-only measurement of the retained grade pilot. Never run by builds. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import * as THREE from "three";
import {
  AUTHORED_VEHICLE_MESHES,
  vehicleMeshHeightScale,
} from "../src/rendering/AuthoredVehicleMeshes.js";

// Expand only after the bridge pilot's contacts, clearance and rider checks qualify.
const pilots = new Set(["compact-1"]);
const profiles: Record<
  string,
  { sha256: string; contacts: { name: string; x: number; y: number; z: number }[] }
> = {};
const rounded = (n: number) => (Math.abs(n) < 0.00001 ? 0 : Number(n.toFixed(6)));
for (const mesh of AUTHORED_VEHICLE_MESHES) {
  if (!pilots.has(mesh.vehicle)) continue;
  const bytes = readFileSync(`public/${mesh.path}`);
  const doc = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  const registration = new THREE.Matrix4()
    .makeScale(1, mesh.lateralScale, vehicleMeshHeightScale(mesh.vehicle))
    .multiply(
      new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.PI / 2, 0, Math.PI, "ZYX")),
    );
  const contacts: { name: string; x: number; y: number; z: number }[] = [];
  function visit(index: number, parent: THREE.Matrix4) {
    const node = doc.nodes[index];
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
    const match = /^Wheel_(.+)_Roll$/.exec(node.name ?? "");
    if (match) {
      const radius = node.extras?.wheel_radius;
      if (!Number.isFinite(radius) || radius <= 0) throw Error("Invalid wheel radius");
      const p = new THREE.Vector3().setFromMatrixPosition(matrix);
      contacts.push({
        name: match[1] ?? "wheel",
        x: rounded(p.x),
        y: rounded(p.y),
        z: rounded(p.z - radius * vehicleMeshHeightScale(mesh.vehicle)),
      });
    }
    for (const child of node.children ?? []) visit(child, matrix);
  }
  for (const root of doc.scenes[doc.scene ?? 0].nodes) visit(root, registration);
  if (contacts.length !== 4 || contacts.some((p) => Math.abs(p.z) > 0.001))
    throw Error("Unqualified pilot wheel contacts");
  profiles[mesh.vehicle] = {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    contacts: contacts.sort((a, b) => a.name.localeCompare(b.name)),
  };
}
const path = "src/traffic/vehicle-ground-contacts.json";
const json = `${JSON.stringify(profiles, null, 2)}\n`;
if (process.argv.includes("--check")) {
  if (readFileSync(path, "utf8") !== json) throw Error("Vehicle ground contacts are stale");
} else writeFileSync(path, json);
console.log(`Verified ${Object.keys(profiles).length} grade pilot's measured wheel contacts.`);

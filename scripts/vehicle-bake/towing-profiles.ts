/** Retain measured axle positions from the actual active GLBs, without loading images. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import * as THREE from "three";
import {
  AUTHORED_VEHICLE_MESHES,
  vehicleMeshHeightScale,
} from "../../src/rendering/AuthoredVehicleMeshes.js";
import { vehicleBodySize } from "../../src/traffic/Vehicle.js";

const profiles: Record<
  string,
  {
    front: number;
    rear: number;
    radius: number;
    rearRadius: number;
    frontZ: number;
    rearZ: number;
    heightScale: number;
    path: string;
    sha256: string;
  }
> = {};
for (const mesh of AUTHORED_VEHICLE_MESHES) {
  const body = vehicleBodySize(`vehicle-v1:${mesh.vehicle}`, 0);
  if (
    body.width > 100 ||
    body.height > 48 ||
    !/^(compact-|unindexed-sedan-|police-car$|rosso-coupe$|beetle$|pickup$|classic-roadster$|offroad-jeep$|race-coupe$|woody-wagon$|microcar$|hot-rod$|rally-hatchback$|retro-taxi$|beach-buggy$)/.test(
      mesh.vehicle,
    )
  )
    continue;
  const bytes = readFileSync(`public/${mesh.path}`);
  const doc = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  const objects = doc.nodes.map(
    (n: {
      name?: string;
      matrix?: number[];
      translation?: number[];
      rotation?: number[];
      scale?: number[];
    }) => {
      const o = new THREE.Object3D();
      o.name = n.name ?? "";
      if (n.matrix) o.matrix.fromArray(n.matrix).decompose(o.position, o.quaternion, o.scale);
      else {
        if (n.translation) o.position.fromArray(n.translation);
        if (n.rotation) o.quaternion.fromArray(n.rotation);
        if (n.scale) o.scale.fromArray(n.scale);
      }
      return o;
    },
  );
  doc.nodes.forEach((n: { children?: number[] }, i: number) => {
    n.children?.forEach((c) => {
      objects[i].add(objects[c]);
    });
  });
  const axles = doc.nodes.flatMap(
    (n: { name?: string; extras?: { wheel_radius?: number } }, i: number) => {
      if (!/^Wheel_[FR][LR]_Roll$/.test(n.name ?? "")) return [];
      const p = objects[i].getWorldPosition(new THREE.Vector3());
      return [{ x: -p.x, z: p.y, radius: n.extras?.wheel_radius }];
    },
  );
  if (
    axles.length !== 4 ||
    !axles.every((a: { radius?: number }) => a.radius && Number.isFinite(a.radius))
  )
    throw Error(`Invalid tow wheel set: ${mesh.vehicle}`);
  const ordered = axles.toSorted((a: { x: number }, b: { x: number }) => a.x - b.x),
    rear = ordered[0],
    front = ordered.at(-1);
  profiles[mesh.vehicle] = {
    rearRadius: rear.radius,
    frontZ: front.z,
    rearZ: rear.z,
    front: Math.max(...axles.map((a: { x: number }) => a.x)),
    rear: Math.min(...axles.map((a: { x: number }) => a.x)),
    radius: front.radius,
    heightScale: vehicleMeshHeightScale(mesh.vehicle),
    path: `public/${mesh.path}`,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
writeFileSync("src/traffic/towing-profiles.json", `${JSON.stringify(profiles, null, 2)}\n`);
console.log(`Measured ${Object.keys(profiles).length} four-wheel passenger models`);

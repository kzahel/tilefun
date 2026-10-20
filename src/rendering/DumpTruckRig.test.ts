import { readFileSync } from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { bedFramePoint, bedGateAngle, DUMP_BED } from "../traffic/VehicleBed.js";
import { CarMeshAsset } from "./CarMeshAsset.js";
import fallback from "./dump-truck-v2-fallback.json" with { type: "json" };

async function load(revision: string) {
  const data = readFileSync(`public/assets/models/vehicles/dump-truck-${revision}.glb`);
  const loader = new GLTFLoader();
  loader.register(() => ({ name: "node-texture", loadTexture: async () => new THREE.Texture() }));
  const gltf = await loader.parseAsync(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    "",
  );
  return new CarMeshAsset(gltf.scene, 1, { batch: true });
}
function vertices(asset: CarMeshAsset) {
  const result: number[][] = [];
  asset.object.updateMatrixWorld(true);
  asset.object.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      const p = node.geometry.getAttribute("position");
      for (let i = 0; i < p.count; i++)
        result.push(
          new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(node.matrixWorld).toArray(),
        );
    }
  });
  return result;
}
function paintedVertices(asset: CarMeshAsset) {
  const result = new Set<string>();
  asset.object.updateMatrixWorld(true);
  asset.object.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      const p = node.geometry.getAttribute("position"),
        uv = node.geometry.getAttribute("uv");
      for (let i = 0; i < p.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(node.matrixWorld);
        result.add(
          [
            Math.round(v.x * 1000),
            Math.round(v.y * 1000),
            Math.round(v.z * 1000),
            Math.round(uv.getX(i) * 1000000),
            Math.round(uv.getY(i) * 1000000),
          ].join(","),
        );
      }
    }
  });
  return result;
}
it("retains the actual v1 vertices at rest and independently poses the bed, tailgate, rams and every wheel", async () => {
  const before = await load("v1"),
    asset = await load("v2");
  try {
    const key = (v: number[]) => v.map((n) => Math.round(n * 1000)).join(",");
    const originals = new Set(vertices(before).map(key));
    asset.setDumpBed(0, 0);
    const rest = vertices(asset);
    expect(paintedVertices(asset)).toEqual(paintedVertices(before));
    for (const v of rest) expect(originals.has(key(v)), `new rest vertex ${v}`).toBe(true);
    expect(new Set(rest.map(key)).size).toBe(originals.size);
    expect(fallback.triangles).toHaveLength(3720);
    const bed = required(asset.object.getObjectByName("Dump_Bed_Hinge")),
      gate = required(asset.object.getObjectByName("Dump_Tailgate_Hinge"));
    const staticBody = required(asset.object.getObjectByName("Body_static"));
    const fixed = staticBody.matrixWorld.clone();
    const wheels = ["FL", "FR", "ML", "MR", "RL", "RR"].map((id) =>
      required(asset.object.getObjectByName(`Wheel_${id}_Roll`)),
    );
    const wheelRest = wheels.map((w) => w.matrixWorld.clone());
    for (const tilt of [0.2, DUMP_BED.maxTilt, 0, 0.4, 0]) {
      const pose = {
        id: 0,
        type: "vehicle-v1:dump-truck",
        vehicleBed: true as const,
        vehicleBedTilt: tilt,
        position: { wx: 0, wy: 0 },
        collider: null,
      };
      asset.setDumpBed(tilt, bedGateAngle(pose));
      asset.object.updateMatrixWorld(true);
      expect(staticBody.matrixWorld.equals(fixed)).toBe(true);
      wheels.forEach((w, i) => {
        expect(w.matrixWorld.equals(required(wheelRest[i]))).toBe(true);
      });
      // A decoded bed-local center and gate hinge match the plain game pose.
      const point = bed.localToWorld(new THREE.Vector3(-1.95, 0.15, 0));
      const expected = bedFramePoint(pose, (-1.17 * 400) / 23, 0, DUMP_BED.floorZ);
      expect(point.x).toBeCloseTo(expected.wx, 4);
      expect(point.z).toBeCloseTo(expected.wz, 4);
      const hinge = gate.getWorldPosition(new THREE.Vector3()),
        hingeExpected = bedFramePoint(pose, DUMP_BED.gateHinge.x, 0, DUMP_BED.gateHinge.z);
      expect(hinge.x).toBeCloseTo(hingeExpected.wx, 4);
      expect(hinge.z).toBeCloseTo(hingeExpected.wz, 4);
      for (const index of [0, 1]) {
        const ram = required(asset.object.getObjectByName(`Dump_Ram_${index}`));
        const length = ram.userData.rest_length as number;
        const tip = ram.localToWorld(new THREE.Vector3(0, length, 0));
        const mount = bed.localToWorld(new THREE.Vector3(...ram.userData.bed_mount_gltf));
        expect(tip.distanceTo(mount)).toBeLessThan(0.0001);
      }
    }
    // Absolute reset on the shared cached resource cannot leak the preceding pose.
    expect(vertices(asset).map(key).sort()).toEqual(rest.map(key).sort());
    asset.setTravel(20);
    asset.object.updateMatrixWorld(true);
    wheels.forEach((w, i) => {
      expect(w.matrixWorld.equals(required(wheelRest[i]))).toBe(false);
    });
    expect(staticBody.matrixWorld.equals(fixed)).toBe(true);
    // Fixed y-z projection exceeds a Euclidean sphere at diagonal headings.
    // Check the complete raised/rest arc against the registered target extent.
    for (let degree = 0; degree <= 48; degree += 4) {
      const tilt = (degree * Math.PI) / 180,
        gate = (Math.min(1, degree / 15) * 80 * Math.PI) / 180;
      asset.object.rotation.z = 0;
      asset.setDumpBed(tilt, gate);
      for (let heading = 0; heading < 16; heading++) {
        asset.object.rotation.z = (heading * Math.PI) / 8;
        let extent = 0;
        for (const v of vertices(asset))
          extent = Math.max(extent, Math.abs(v[0] ?? 0), Math.abs((v[1] ?? 0) - (v[2] ?? 0)));
        expect(extent).toBeLessThan(128);
      }
    }
  } finally {
    before.dispose();
    asset.dispose();
  }
});

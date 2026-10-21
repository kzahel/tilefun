import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
// @ts-expect-error pngjs has no bundled declarations
import { PNG } from "pngjs";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { expect, it } from "vitest";
import captureRecipe from "../../art-source/vehicle-bake/towing-fallbacks/v2/recipe.json" with {
  type: "json",
};
import { required } from "../art/ArtCatalog.js";
import { Direction } from "../entities/Entity.js";
import { applyEntityDelta, diffEntitySnapshots } from "../shared/entityDelta.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import { TOW, towMeshOffset, towPitch } from "../traffic/Towing.js";
import profiles from "../traffic/towing-profiles.json" with { type: "json" };
import { createVehicle } from "../traffic/Vehicle.js";
import { CarMeshAsset } from "./CarMeshAsset.js";
import frames from "./towing-fallbacks.json" with { type: "json" };

it("keeps every captured lift/car view inside its native frame, including fully extended down", () => {
  expect(
    createHash("sha256").update(readFileSync("src/rendering/towing-fallbacks.json")).digest("hex"),
  ).toBe(captureRecipe.outputs["frames.json"]);
  for (const [path, size, rows] of [
    ["cars", frames.carSize, frames.keys.length],
    ["truck", frames.truckSize, 2],
  ] as const) {
    const bytes = readFileSync(`public/assets/vehicles/towing-${path}-v2.png`);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      captureRecipe.outputs[`${path}.png`],
    );
    const image: { width: number; height: number; data: Uint8Array } = PNG.sync.read(bytes);
    expect(image.width).toBe(4 * size);
    expect(image.height).toBe(rows * size);
    const clipped: string[] = [];
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < 4; col++)
        for (let p = 0; p < size; p++) {
          for (const [x, y] of [
            [col * size + p, row * size],
            [col * size + p, (row + 1) * size - 1],
            [col * size, row * size + p],
            [(col + 1) * size - 1, row * size + p],
          ] as const)
            if (image.data[(y * image.width + x) * 4 + 3]) clipped.push(`${row}:${col}:${x}:${y}`);
        }
    expect(clipped, `${path} native frame edge`).toEqual([]);
  }
});

it("hydrates pending and resident towing links, then clears them without a stale collider", () => {
  const car = createVehicle("beetle", 0, 0, Direction.Right),
    before = serializeEntity(car);
  const h = required(required(car.collider).physicalHeight);
  car.towedBy = 0;
  const pending = deserializeEntity(serializeEntity(car));
  expect(pending.towedBy).toBe(0);
  expect(required(pending.collider).physicalHeight).toBe(h + 12);
  car.towedBy = 0xfedcba98;
  const attached = serializeEntity(car),
    copy = deserializeEntity(before);
  applyEntityDelta(copy, required(diffEntitySnapshots(before, attached)));
  expect(copy.towedBy).toBe(car.towedBy);
  expect(required(copy.collider).physicalHeight).toBe(h + 12);
  applyEntityDelta(copy, required(diffEntitySnapshots(attached, before)));
  expect(copy.towedBy).toBeUndefined();
  expect(required(copy.collider).physicalHeight).toBe(h);
});

async function load(path: string, lateral = 1, heightScale = 1) {
  const bytes = readFileSync(path),
    loader = new GLTFLoader();
  loader.register(() => ({ name: "node-texture", loadTexture: async () => new THREE.Texture() }));
  const gltf = await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
  return new CarMeshAsset(gltf.scene, lateral, { batch: true, heightScale });
}
it("keeps the v1 body and wheels fixed while its actual telescoping rig resets absolutely", async () => {
  const old = await load("public/assets/models/vehicles/tow-truck-v1.glb"),
    asset = await load("public/assets/models/vehicles/tow-truck-v2.glb");
  try {
    const body = required(asset.object.getObjectByName("Body_static")),
      oldBody = required(old.object.getObjectByName("Body_static"));
    expect(Array.from((body as THREE.Mesh).geometry.getAttribute("position").array)).toEqual(
      Array.from((oldBody as THREE.Mesh).geometry.getAttribute("position").array),
    );
    expect(Array.from((body as THREE.Mesh).geometry.getAttribute("uv").array)).toEqual(
      Array.from((oldBody as THREE.Mesh).geometry.getAttribute("uv").array),
    );
    asset.object.updateMatrixWorld(true);
    const fixed = body.matrixWorld.clone();
    const cradle = required(asset.object.getObjectByName("Tow_Lift_Cradle"));
    for (const active of [false, true, false, true, false]) {
      asset.setTowLift(active);
      asset.object.updateMatrixWorld(true);
      const p = cradle.getWorldPosition(new THREE.Vector3());
      expect(p.x).toBeCloseTo(active ? TOW.hitch : -51, 4);
      expect(p.z).toBeCloseTo(active ? 10 : 4, 4);
      expect(body.matrixWorld.equals(fixed)).toBe(true);
    }
    asset.setTravel(20, true);
    expect(
      required(asset.object.getObjectByName("Wheel_FL_Roll")).quaternion.angleTo(
        new THREE.Quaternion(),
      ),
    ).toBeCloseTo(0);
    expect(
      required(asset.object.getObjectByName("Wheel_RL_Roll")).quaternion.angleTo(
        new THREE.Quaternion(),
      ),
    ).toBeGreaterThan(0.1);
    asset.setTravel(0, false);
    expect(
      required(asset.object.getObjectByName("Wheel_RL_Roll")).quaternion.angleTo(
        new THREE.Quaternion(),
      ),
    ).toBeCloseTo(0);
  } finally {
    old.dispose();
    asset.dispose();
  }
});
it("pins every qualified model's measured axles and rear ground contact, with the front lifted", async () => {
  for (const [model, p] of Object.entries(profiles)) {
    const bytes = readFileSync(p.path);
    expect(createHash("sha256").update(bytes).digest("hex"), model).toBe(p.sha256);
    const asset = await load(p.path, 1, p.heightScale);
    try {
      asset.object.updateMatrixWorld(true);
      const front = required(asset.object.getObjectByName("Wheel_FL_Roll")).getWorldPosition(
          new THREE.Vector3(),
        ),
        rear = required(asset.object.getObjectByName("Wheel_RL_Roll")).getWorldPosition(
          new THREE.Vector3(),
        );
      expect(front.x, model).toBeCloseTo(p.front, 4);
      expect(rear.x, model).toBeCloseTo(p.rear, 4);
      const entity = { type: `vehicle-v1:${model}`, towedBy: 1 },
        pitch = towPitch(entity),
        offset = towMeshOffset(entity);
      asset.object.rotation.y = -pitch;
      asset.object.position.set(offset.x, 0, offset.z);
      asset.object.updateMatrixWorld(true);
      const bottom = (name: string) => {
        const wheel = required(asset.object.getObjectByName(name));
        let z = Infinity;
        wheel.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            const a = o.geometry.getAttribute("position");
            for (let i = 0; i < a.count; i++)
              z = Math.min(
                z,
                new THREE.Vector3().fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld).z,
              );
          }
        });
        return z;
      };
      expect(bottom("Wheel_RL_Roll"), model).toBeGreaterThan(-0.12);
      expect(bottom("Wheel_RL_Roll"), model).toBeLessThan(0.12);
      expect(bottom("Wheel_FL_Roll"), model).toBeCloseTo(TOW.lift, 0);
    } finally {
      asset.dispose();
    }
  }
});

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { TerrainId } from "../autotile/TerrainId.js";
import { getEntityAABB } from "../entities/collision.js";
import { createDescriptor } from "../generation/GenerationDescriptor.js";
import { createGenerator } from "../generation/Generator.js";
import { NaturalLandscape } from "../generation/regional/NaturalLandscape.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { CarMeshAsset } from "../rendering/CarMeshAsset.js";
import {
  applyVehicleFacing,
  createVehicle,
  DRIVABLE_MODELS,
  TRAFFIC_MODELS,
  VEHICLE_MODELS,
} from "../traffic/Vehicle.js";
import { World } from "../world/World.js";
import { BOAT_MESH, BOAT_MODEL } from "./Boat.js";

const lakeOwner = [1, -2] as const;
it("retains exact editable source and a wheel-free exported boat with animated propeller", async () => {
  const receipt = JSON.parse(
    readFileSync("art-source/vehicle-models/explorer-boat/v1/receipt.json", "utf8"),
  );
  for (const [path, hash] of Object.entries(receipt.inputs))
    expect(createHash("sha256").update(readFileSync(path)).digest("hex"), path).toBe(hash);
  const data = readFileSync(`public/${BOAT_MESH.path}`);
  expect(createHash("sha256").update(data).digest("hex")).toBe(receipt.modelSha256);
  expect(
    createHash("sha256")
      .update(readFileSync(`public/${receipt.sprite.replace(/^public\//, "")}`))
      .digest("hex"),
  ).toBe(receipt.spriteSha256);
  const loader = new GLTFLoader();
  loader.register(() => ({ name: "test-texture", loadTexture: async () => new THREE.Texture() }));
  const gltf = await loader.parseAsync(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    "",
  );
  const asset = new CarMeshAsset(gltf.scene, 1, {
    batch: true,
    contactShadow: true,
    preserveParts: BOAT_MESH.batchPreserveParts,
  });
  try {
    expect(asset.object.getObjectByName("Boat_Root")?.userData.tilefun_watercraft).toBe(1);
    expect(asset.object.getObjectByName("Wheel_FL_Roll")).toBeUndefined();
    expect(asset.object.getObjectByName("Game-contact-shadow")).toBeUndefined();
    const propeller = required(asset.object.getObjectByName("Boat_Propeller"));
    const rest = propeller.quaternion.clone();
    asset.setTravel(2);
    expect(propeller.quaternion.equals(rest)).toBe(false);
    asset.setTravel(0);
    expect(propeller.quaternion.equals(rest)).toBe(true);
    for (let i = 0; i < 16; i++) {
      asset.object.rotation.z = (i * Math.PI) / 8;
      asset.object.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(asset.object, true);
      const e = createVehicle(BOAT_MODEL, 0, 0);
      e.vehicleHeading = asset.object.rotation.z;
      applyVehicleFacing(e);
      const body = getEntityAABB(e.position, required(e.collider));
      expect(bounds.min.x).toBeGreaterThanOrEqual(body.left - 0.001);
      expect(bounds.max.x).toBeLessThanOrEqual(body.right + 0.001);
      expect(bounds.min.y).toBeGreaterThanOrEqual(body.top - 0.001);
      expect(bounds.max.y).toBeLessThanOrEqual(body.bottom + 0.001);
    }
  } finally {
    asset.dispose();
  }
  expect(DRIVABLE_MODELS).toContain(BOAT_MODEL);
  expect(VEHICLE_MODELS).not.toContain(BOAT_MODEL);
  expect(TRAFFIC_MODELS).not.toContain(BOAT_MODEL);
});

it("creates broad connected water, a dry boarding beach and varied valid natural creatures deterministically", () => {
  const collect = (reverse: boolean) => {
    const n = new NaturalLandscape(regionalWorld(2026), "thicket");
    const lake = required(n.lake(...lakeOwner));
    const coords = Array.from(
      { length: 225 },
      (_, i) =>
        [
          Math.floor(lake.x / 16) - 7 + (i % 15),
          Math.floor(lake.y / 16) - 7 + Math.floor(i / 15),
        ] as const,
    );
    const animals = (reverse ? coords.reverse() : coords)
      .flatMap(([x, y]) => n.wildlife(x, y))
      .filter((e) => e.featureId.includes(`:lake:${lakeOwner[0]}:${lakeOwner[1]}:`))
      .sort((a, b) => a.featureId.localeCompare(b.featureId));
    return { n, lake, animals };
  };
  const { n, lake, animals } = collect(false);
  expect(lake.rx).toBeGreaterThan(50);
  expect(lake.ry).toBeGreaterThan(35);
  expect(animals).toHaveLength(23);
  expect(new Set(animals.map((a) => a.type)).size).toBe(8);
  expect(animals).toEqual(collect(true).animals);
  for (const a of animals) expect(n.terrain(a.wx / 16, a.wy / 16)).toBe(TerrainId.DeepWater);
  expect(n.terrain(lake.x, lake.y - lake.ry - 1.25)).toBe(TerrainId.Sand);
  const g = createGenerator(createDescriptor("regional", 2026));
  const world = new World(g.terrain);
  const x = Math.floor(lake.x / 16),
    y = Math.floor(lake.y / 16);
  const left = world.getChunk(x, y),
    right = world.getChunk(x + 1, y);
  for (let row = 0; row < 33; row++)
    expect(left.getSubgrid(32, row)).toBe(right.getSubgrid(0, row));
});

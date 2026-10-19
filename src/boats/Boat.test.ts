import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { TerrainId } from "../autotile/TerrainId.js";
import { PlayerPredictor } from "../client/PlayerPredictor.js";
import { aabbLacksWater, getEntityAABB } from "../entities/collision.js";
import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import { createDescriptor } from "../generation/GenerationDescriptor.js";
import { createGenerator } from "../generation/Generator.js";
import { NaturalLandscape } from "../generation/regional/NaturalLandscape.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { Camera } from "../rendering/Camera.js";
import { CarMeshAsset } from "../rendering/CarMeshAsset.js";
import { collectScene } from "../rendering/collectScene.js";
import { naturalLandscapeRecipe } from "../scenarios/NaturalLandscapeRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import { boardingDistance, drivenCarPose } from "../traffic/Driving.js";
import {
  createVehicle,
  DRIVABLE_MODELS,
  TRAFFIC_MODELS,
  VEHICLE_MODELS,
} from "../traffic/Vehicle.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import { World } from "../world/World.js";
import { BOAT_MESH, BOAT_MODEL, BOAT_SEAT_Z, BOAT_SIZE, isBoat } from "./Boat.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
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
    preserveParts: BOAT_MESH.batchPreserveParts,
  });
  try {
    expect(asset.object.getObjectByName("Boat_Root")?.userData.tilefun_watercraft).toBe(1);
    expect(asset.object.getObjectByName("Wheel_FL_Roll")).toBeUndefined();
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
      expect(
        Math.max(
          Math.abs(bounds.min.x),
          Math.abs(bounds.max.x),
          Math.abs(bounds.min.y),
          Math.abs(bounds.max.y),
        ),
      ).toBeLessThan(BOAT_SIZE / 2);
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
  expect(animals).toHaveLength(21);
  expect(new Set(animals.map((a) => a.type)).size).toBe(6);
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

it("keeps moorings on water and within boarding reach across fractional shore alignments", () => {
  const n = new NaturalLandscape(regionalWorld(2026), "thicket");
  const g = createGenerator(createDescriptor("regional", 2026));
  const world = new World(g.terrain);
  for (const [x, y] of [
    [1, -2],
    [2, -1],
    [3, -3],
    [3, 2],
  ] as const) {
    const lake = required(n.lake(x, y));
    const shore = (lake.y - lake.ry) * 16;
    const cx = Math.floor(lake.x / 16),
      cy = Math.floor((shore + 44) / 256);
    const p = required(n.boats(cx, cy)[0]);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) world.getChunk(cx + dx, cy + dy);
    const boat = createVehicle(BOAT_MODEL, p.wx, p.wy);
    expect(drivenCarPose(boat, idle, 1 / 60, world, [], []), lake.id).toBeDefined();
    expect(boardingDistance(createPlayer(lake.x * 16, shore - 20), boat)).toBeLessThanOrEqual(32);
  }
});

it("shares water-only rolling steering and reverse while refusing shore, obstacles and unloaded water", () => {
  const world = new World(new FlatStrategy());
  for (let y = -2; y <= 2; y++)
    for (let x = -2; x <= 2; x++) world.getChunk(x, y).collision.fill(CollisionFlag.Water);
  let e = createVehicle(BOAT_MODEL, 0, 0, Direction.Right);
  const first = required(drivenCarPose(e, { dx: 0, dy: 1 }, 1 / 60, world, [], []));
  expect(first.vehicleHeading).toBeGreaterThan(0);
  for (let i = 0; i < 90; i++)
    e = required(drivenCarPose(e, { dx: 0, dy: 1 }, 1 / 60, world, [], []));
  expect(e.position.wy).toBeGreaterThan(0);
  expect(e.position.wx).toBeGreaterThan(10);
  e = createVehicle(BOAT_MODEL, 0, 0, Direction.Right);
  for (let i = 0; i < 90; i++)
    e = required(drivenCarPose(e, { dx: 0, dy: 0, reversing: true }, 1 / 60, world, [], []));
  expect(e.velocity?.vx).toBeCloseTo(-38);
  const dry = new World(new FlatStrategy());
  dry.getChunk(0, 0);
  expect(
    drivenCarPose(createVehicle(BOAT_MODEL, 96, 96), idle, 1 / 60, dry, [], []),
  ).toBeUndefined();
  expect(drivenCarPose(e, idle, 1 / 60, new World(new FlatStrategy()), [], [])).toBeUndefined();
  const other = createVehicle(BOAT_MODEL, e.position.wx, e.position.wy);
  other.id = 99;
  expect(drivenCarPose(e, idle, 1 / 60, world, [], [other], undefined, [])).toBeUndefined();
});

it("boards a natural shore boat, predicts the open seat, drives, reloads and keeps deleted boats gone", async () => {
  const s = await ScenarioSession.create(naturalLandscapeRecipe("lake", "thicket"));
  try {
    const find = () => [...required(s.realm.traffic).states.values()].find((v) => isBoat(v.entity));
    for (let i = 0; i < 130 && !find(); i++) await s.step(idle);
    let state = required(find(), "Natural boat missing"),
      boat = state.entity;
    const identity = boat.proceduralId;
    expect(
      aabbLacksWater(getEntityAABB(boat.position, required(boat.collider)), (x, y) =>
        s.realm.world.getCollisionIfLoaded(x, y),
      ),
    ).toBe(false);
    s.realm.vehicles.enter(s.player, boat.id);
    expect(s.player.player.parentId).toBe(boat.id);
    expect(s.player.player.wz).toBe(BOAT_SEAT_Z);
    const camera = new Camera();
    camera.setViewport(960, 640);
    camera.x = boat.position.wx;
    camera.y = boat.position.wy;
    const visible = collectScene(
      s.realm.entityManager.entities,
      [],
      s.realm.world,
      camera,
      camera.getVisibleChunkRange(),
      1,
      { collectElevationItems: () => [] },
      [],
      false,
    );
    expect(
      visible.filter((e) => e.kind === "sprite" && e.sheetKey === s.player.player.sprite?.sheetKey),
    ).toHaveLength(1);
    const predictor = new PlayerPredictor();
    predictor.reset(
      deserializeEntity(serializeEntity(s.player.player)),
      deserializeEntity(serializeEntity(boat)),
    );
    const before = { ...boat.position };
    for (let i = 0; i < 100; i++) {
      predictor.update(
        0.01667,
        { ...idle, dy: 1 },
        s.realm.world,
        s.realm.propManager.props,
        s.realm.entityManager.entities,
      );
      await s.step({ ...idle, dy: 1 });
    }
    expect(predictor.mount?.position.wx).toBeCloseTo(boat.position.wx, 3);
    expect(predictor.mount?.position.wy).toBeCloseTo(boat.position.wy, 3);
    expect(predictor.player?.wz).toBe(BOAT_SEAT_Z);
    expect(Math.hypot(boat.position.wx - before.wx, boat.position.wy - before.wy)).toBeGreaterThan(
      30,
    );
    const pose = { ...boat.position },
      heading = boat.vehicleHeading;
    await s.reload();
    state = required(find());
    boat = state.entity;
    expect(boat.position).toEqual(pose);
    expect(boat.vehicleHeading).toBe(heading);
    expect(s.player.player.parentId).toBe(boat.id);
    expect(s.player.player.wz).toBe(BOAT_SEAT_Z);
    // Return to the real original beach for a safe exit, never dismount into water.
    boat.position = before;
    boat.velocity = { vx: 0, vy: 0 };
    s.realm.vehicles.sync();
    s.realm.vehicles.exit(s.player);
    expect(
      s.realm.world.getCollisionIfLoaded(
        Math.floor(s.player.player.position.wx / 16),
        Math.floor(s.player.player.position.wy / 16),
      ) & CollisionFlag.Water,
    ).toBe(0);
    s.realm.entityManager.remove(boat.id);
    await s.reload();
    for (let i = 0; i < 130; i++) await s.step(idle);
    expect(
      [...required(s.realm.traffic).states.values()].some(
        (v) => v.entity.proceduralId === identity,
      ),
    ).toBe(false);
  } finally {
    await s.close();
  }
}, 60000);

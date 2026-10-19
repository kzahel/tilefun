import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
// @ts-expect-error pngjs has no bundled declarations
import { PNG } from "pngjs";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { SPRITE_MANIFEST } from "../assets/GameAssets.js";
import { VEHICLE_PALETTE } from "../editor/EditorPalettes.js";
import { Direction } from "../entities/Entity.js";
import {
  AUTHORED_VEHICLE_MESHES,
  authoredVehicleForType,
  vehicleMeshHeightScale,
} from "../rendering/AuthoredVehicleMeshes.js";
import { CarMeshAsset } from "../rendering/CarMeshAsset.js";
import { EntityMeshPose } from "../rendering/EntityMeshPose.js";
import { applyEntityDelta, diffEntitySnapshots } from "../shared/entityDelta.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import { ORIGINAL_VEHICLES } from "./OriginalVehicles.js";
import { TrafficTestHarness } from "./TrafficTestHarness.js";
import {
  applyVehicleFacing,
  createVehicle,
  TRAFFIC_MODELS,
  VEHICLE_BANK,
  VEHICLE_MODELS,
  vehicleRoadWidth,
  vehicleTurningRadius,
} from "./Vehicle.js";
import { vehiclePerformance } from "./VehiclePerformance.js";

it.each([
  {
    id: "rosso-coupe",
    name: "Red sports coupe",
    receiptPath: "art-source/vehicle-bake/runtime-rosso-coupe-v3.json",
    captures: "public/demos/vehicle-bake/captures/a-reduced-projection--mid-fenders-v3",
    bounds: [82, 36, 19],
    speed: 156,
    nativeSize: 128,
  },
  {
    id: "beetle",
    name: "Beetle-style compact",
    receiptPath: "art-source/vehicle-bake/runtime-beetle-v1.json",
    captures: "public/demos/original-vehicles/beetle-v1/captures",
    bounds: [81, 38, 35],
    speed: 105,
    nativeSize: 128,
  },
  {
    id: "school-bus",
    name: "Yellow school bus",
    receiptPath: "art-source/vehicle-bake/runtime-school-bus-v1.json",
    captures: "public/demos/original-vehicles/school-bus-v1/captures",
    bounds: [122, 43, 44],
    speed: 78,
    nativeSize: 224,
  },
])("ships $id reviewed mesh and exact game-camera fallback for every facing", (family) => {
  const definition = required(ORIGINAL_VEHICLES.find((vehicle) => vehicle.id === family.id));
  const [length, width, height] = family.bounds as [number, number, number];
  const type = `vehicle-v1:${definition.id}`;
  const receipt = JSON.parse(readFileSync(family.receiptPath, "utf8"));
  const model = readFileSync(`public/${definition.mesh.path}`);
  expect(createHash("sha256").update(model).digest("hex")).toBe(receipt.modelSha256);
  for (const [path, expected] of Object.entries(receipt.inputs)) {
    expect(createHash("sha256").update(readFileSync(path)).digest("hex"), path).toBe(expected);
  }
  expect(authoredVehicleForType(type)?.path).toBe(definition.mesh.path);
  expect(VEHICLE_BANK.views).toHaveLength(180);
  expect(TRAFFIC_MODELS).toContain(definition.id);
  expect(VEHICLE_PALETTE.find((entry) => entry.type === type)?.label).toBe(family.name);
  expect(SPRITE_MANIFEST.find((entry) => entry.key === type)?.path).toBe(definition.sprite);
  const sprite = readFileSync(`public/${definition.sprite}`);
  expect(createHash("sha256").update(sprite).digest("hex")).toBe(receipt.spriteSha256);
  const sheet = PNG.sync.read(sprite);
  expect([sheet.width, sheet.height]).toEqual([192, 896]);
  const expectedSheet = Buffer.alloc(sheet.data.length);
  const n = family.nativeSize;
  for (const [row, index] of [4, 12, 8, 0].entries()) {
    const frame = PNG.sync.read(readFileSync(`${family.captures}/engine-${index}.png`));
    expect([frame.width, frame.height]).toEqual([n, n]);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const source = (y * n + x) * 4;
        if (!frame.data[source + 3]) continue;
        const dx = x + 96 - n / 2,
          dy = y + 144 - n / 2;
        // Only transparent margins may be cropped, including the bus's 224px viewport.
        expect(dx).toBeGreaterThanOrEqual(0);
        expect(dx).toBeLessThan(192);
        expect(dy).toBeGreaterThanOrEqual(0);
        expect(dy).toBeLessThan(224);
        frame.data.copy(expectedSheet, ((row * 224 + dy) * 192 + dx) * 4, source, source + 4);
      }
    }
    const view = required(definition.views[row]);
    const [x, y] = view.rect;
    const side = row >= 2;
    expect(view.metadata.anchor).toEqual([
      96 - required(x),
      144 + row * 224 - required(y) + (side ? width : length) / 2,
    ]);
  }
  expect(sheet.data).toEqual(expectedSheet);
  for (const facing of [Direction.Down, Direction.Up, Direction.Left, Direction.Right]) {
    const car = createVehicle(definition.id, 120, 240, facing);
    expect(car.collider?.physicalHeight).toBe(height);
    expect([car.collider?.width, car.collider?.height]).toEqual(
      facing === Direction.Left || facing === Direction.Right ? [length, width] : [width, length],
    );
    expect(deserializeEntity(serializeEntity(car)).collider).toEqual(car.collider);
    expect(car.sprite?.frameRow).toBe(facing);
    const snapshot = serializeEntity(car);
    const client = deserializeEntity(snapshot);
    applyVehicleFacing(car, facing === Direction.Right ? Direction.Up : Direction.Right);
    applyEntityDelta(client, required(diffEntitySnapshots(snapshot, serializeEntity(car))));
    expect(client.collider).toEqual(car.collider);
    expect(client.sprite?.frameRow).toBe(car.sprite?.frameRow);
  }
  expect(vehicleRoadWidth(type)).toBe(width * 2 + 12);
  expect(vehicleTurningRadius(type)).toBeCloseTo(length * 0.7);
  expect(vehiclePerformance(type).speed).toBe(family.speed);
  expect(authoredVehicleForType(type)?.lateralScale).toBe(1);
  expect(vehicleMeshHeightScale(family.id)).toBe(1);
  const car = createVehicle(family.id, 120, 240, Direction.Down);
  expect(new EntityMeshPose().evaluate(car, 1)).toMatchObject({
    assetId: definition.mesh.assetId,
    radius: family.nativeSize / 2,
  });
});

it("encloses the Beetle's actual imported vertices without floor or size distortion", () => {
  const receipt = JSON.parse(
    readFileSync("art-source/vehicle-bake/runtime-beetle-v1.json", "utf8"),
  );
  expect(receipt.measurement.modelSha256).toBe(receipt.modelSha256);
  expect(receipt.measurement.triangles).toBe(2554);
  expect(receipt.measurement.meshes).toBe(5);
  expect(receipt.measurement.worldBounds.min[2]).toBeCloseTo(0, 5);
  expect(receipt.measurement.worldBounds.size.map(Math.ceil)).toEqual([81, 38, 35]);
  expect(receipt.capture).toEqual({
    frameSize: [128, 128],
    groundOrigin: [64, 64],
    cardinals: { south: 4, north: 12, west: 8, east: 0 },
  });
  expect(receipt.sourceOnlyReplay).toMatchObject({
    byteIdentical: true,
    scratchInputDependencies: [],
  });
  expect(vehiclePerformance("vehicle-v1:beetle").acceleration).toBeLessThan(
    vehiclePerformance("vehicle-v1:compact-1").acceleration,
  );
});

it("registers every combined model exactly once across editor, assets, traffic and own meshes", () => {
  expect(VEHICLE_MODELS).toHaveLength(
    new Set(VEHICLE_BANK.views.map((view) => view.vehicleId)).size + ORIGINAL_VEHICLES.length,
  );
  expect(new Set(VEHICLE_MODELS).size).toBe(VEHICLE_MODELS.length);
  expect(TRAFFIC_MODELS).toHaveLength(VEHICLE_MODELS.length - 1);
  expect(AUTHORED_VEHICLE_MESHES).toHaveLength(VEHICLE_MODELS.length);
  for (const model of VEHICLE_MODELS) {
    const type = `vehicle-v1:${model}`;
    expect(VEHICLE_PALETTE.filter((entry) => entry.type === type)).toHaveLength(1);
    expect(SPRITE_MANIFEST.filter((entry) => entry.key === type)).toHaveLength(1);
    expect(AUTHORED_VEHICLE_MESHES.filter((entry) => entry.vehicle === model)).toHaveLength(1);
  }
});

it.each([
  { model: "beetle", roadWidth: 88 },
  { model: "school-bus", roadWidth: 98 },
])("admits $model through ordinary generated-road traffic selection", ({ model, roadWidth }) => {
  const scene = new TrafficTestHarness();
  for (const state of [...scene.traffic.states.values()])
    scene.entities.remove(state.entity.id, false);
  // Persisted exclusions isolate the new identity without replacing production
  // lane selection, random model choice, width admission or collision checks.
  scene.traffic.canSpawn = (identity) => identity.includes(`:${model}:`);
  const graph = scene.strategy.trafficNetwork(4800, 8304);
  for (const position of [
    { x: 4800, y: 8304 },
    ...[...graph.lanes.values()].slice(0, 12).map((lane) => lane.a),
  ]) {
    scene.player.position = { wx: position.x, wy: position.y };
    const cx = Math.floor(position.x / 256),
      cy = Math.floor(position.y / 256);
    for (let y = cy - 7; y <= cy + 7; y++)
      for (let x = cx - 7; x <= cx + 7; x++) scene.world.getChunk(x, y);
    scene.traffic.visibleRanges = [{ minCx: cx, maxCx: cx, minCy: cy, maxCy: cy }];
    scene.traffic.tick(2.1, [scene.player]);
    if (scene.traffic.states.size) break;
  }
  const car = required([...scene.traffic.states.values()][0]);
  expect(car.entity.type).toBe(`vehicle-v1:${model}`);
  expect(car.placed).not.toBe(true);
  expect(car.lane.width).toBeGreaterThanOrEqual(roadWidth);
  expect(car.entity.proceduralId).toContain("traffic-v1:");
});

it("preserves the exact 45-type source bank", () => {
  expect(
    createHash("sha256").update(readFileSync("src/traffic/vehicles-v1.json")).digest("hex"),
  ).toBe("79cc6b59a727101304bde0beb7fe7e810703f3037ab9fcd4260334c55d8bf4c6");
  expect(new Set(VEHICLE_BANK.views.map((view) => view.vehicleId)).size).toBe(45);
});

it("keeps the accepted school bus at native world scale with conservative physical bounds and heavy handling", async () => {
  const definition = required(ORIGINAL_VEHICLES.find((vehicle) => vehicle.id === "school-bus"));
  const model = readFileSync(`public/${definition.mesh.path}`);
  expect(createHash("sha256").update(model).digest("hex")).toBe(
    "4b71cb259c5226af9657fe624585354ad66c41b3b66c5a2a2cf25ba61d3df42f",
  );
  expect(model).toEqual(
    readFileSync("public/demos/original-vehicles/school-bus-v1/inputs/model.glb"),
  );
  // Decode actual geometry/transforms through the production loader. Image decode
  // is replaced only in this Node test; exact embedded atlas pixels are checked below.
  const loader = new GLTFLoader();
  loader.register(() => ({ name: "node-texture", loadTexture: async () => new THREE.Texture() }));
  const gltf = await loader.parseAsync(
    model.buffer.slice(model.byteOffset, model.byteOffset + model.byteLength),
    "",
  );
  const asset = new CarMeshAsset(gltf.scene, definition.mesh.lateralScale, {
    batch: true,
    heightScale: vehicleMeshHeightScale(definition.id),
  });
  try {
    asset.object.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(asset.object, true);
    const size = bounds.getSize(new THREE.Vector3()).toArray();
    expect(size.map(Math.ceil)).toEqual([122, 43, 44]);
    [121.2174, 42.7826, 43.1304].forEach((value, axis) => {
      expect(size[axis]).toBeCloseTo(value, 3);
    });
    expect(bounds.min.z).toBeCloseTo(0, 5);
    expect(asset.meshCount).toBe(5);
    expect(asset.drawMeshCount).toBe(5);
    const json = gltf.parser.json;
    expect(
      json.meshes
        .flatMap((mesh: { primitives: { indices: number }[] }) => mesh.primitives)
        .reduce(
          (sum: number, primitive: { indices: number }) =>
            sum + json.accessors[primitive.indices].count / 3,
          0,
        ),
    ).toBe(2564);
    expect(json.materials).toHaveLength(1);
    expect(json.materials[0].extensions).toHaveProperty("KHR_materials_unlit");
    expect(json.materials[0].alphaMode ?? "OPAQUE").toBe("OPAQUE");
    const atlasView = json.bufferViews[json.images[0].bufferView];
    const binaryOffset = 20 + model.readUInt32LE(12) + 8;
    const atlasBytes = model.subarray(
      binaryOffset + atlasView.byteOffset,
      binaryOffset + atlasView.byteOffset + atlasView.byteLength,
    );
    expect(atlasBytes).toEqual(
      readFileSync("public/demos/original-vehicles/school-bus-v1/inputs/atlas.png"),
    );
    const atlas = PNG.sync.read(atlasBytes);
    expect([atlas.width, atlas.height]).toEqual([512, 512]);
  } finally {
    asset.dispose();
  }
  const receipt = JSON.parse(
    readFileSync("art-source/vehicle-bake/runtime-school-bus-v1.json", "utf8"),
  );
  expect(receipt.physicalBounds).toEqual([122, 43, 44]);
  expect(receipt.capture).toEqual({
    frameSize: [224, 224],
    groundOrigin: [112, 112],
    cardinals: { south: 4, north: 12, west: 8, east: 0 },
  });
  expect(receipt.sourceOnlyReplay).toMatchObject({
    byteIdentical: true,
    scratchInputDependencies: [],
  });
  expect(definition.mesh).toMatchObject({ radius: 112, lateralScale: 1 });
  expect(vehicleRoadWidth("vehicle-v1:school-bus")).toBe(98);
  expect(vehicleTurningRadius("vehicle-v1:school-bus")).toBeCloseTo(85.4);
  expect(vehiclePerformance("vehicle-v1:school-bus")).toEqual({
    speed: 78,
    acceleration: 100,
    pushSpeed: 64,
    pushWeight: 500,
  });
});

it("excludes school buses from narrow generated roads while allowing smaller traffic", () => {
  const scene = new TrafficTestHarness();
  for (const state of [...scene.traffic.states.values()])
    scene.entities.remove(state.entity.id, false);
  const graph = scene.strategy.trafficNetwork(4800, 8304);
  // Hold this generated region fixed while exercising the public population path.
  scene.strategy.trafficNetwork = () => graph;
  for (const lane of graph.lanes.values()) lane.width = Math.min(lane.width, 97);
  const considered: string[] = [];
  scene.traffic.canSpawn = (identity) => {
    considered.push(identity);
    return true;
  };
  for (const position of [
    { x: 4800, y: 8304 },
    ...[...graph.lanes.values()].slice(0, 12).map((lane) => lane.a),
  ]) {
    scene.player.position = { wx: position.x, wy: position.y };
    const cx = Math.floor(position.x / 256),
      cy = Math.floor(position.y / 256);
    for (let y = cy - 7; y <= cy + 7; y++)
      for (let x = cx - 7; x <= cx + 7; x++) scene.world.getChunk(x, y);
    scene.traffic.visibleRanges = [{ minCx: cx, maxCx: cx, minCy: cy, maxCy: cy }];
    scene.traffic.tick(2.1, [scene.player]);
  }
  expect(considered.length).toBeGreaterThan(0);
  expect(considered.some((identity) => identity.includes(":school-bus:"))).toBe(false);
  const cars = [...scene.traffic.states.values()];
  expect(cars.length).toBeGreaterThan(0);
  expect(
    cars.every((car) => car.lane.width < 98 && car.entity.type !== "vehicle-v1:school-bus"),
  ).toBe(true);
});

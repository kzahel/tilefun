import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
// @ts-expect-error pngjs has no bundled declarations
import { PNG } from "pngjs";
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
  },
  {
    id: "beetle",
    name: "Beetle-style compact",
    receiptPath: "art-source/vehicle-bake/runtime-beetle-v1.json",
    captures: "public/demos/original-vehicles/beetle-v1/captures",
    bounds: [81, 38, 35],
    speed: 105,
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
  const sheet = PNG.sync.read(readFileSync(`public/${definition.sprite}`));
  expect([sheet.width, sheet.height]).toEqual([192, 896]);
  for (const [row, index] of [4, 12, 8, 0].entries()) {
    const frame = PNG.sync.read(readFileSync(`${family.captures}/engine-${index}.png`));
    for (let y = 0; y < 128; y++) {
      const offset = ((row * 224 + 80 + y) * 192 + 32) * 4;
      expect(sheet.data.subarray(offset, offset + 128 * 4)).toEqual(
        frame.data.subarray(y * 128 * 4, (y + 1) * 128 * 4),
      );
    }
  }
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
    radius: 64,
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

it("admits Beetle through ordinary generated-road traffic selection", () => {
  const scene = new TrafficTestHarness();
  for (const state of [...scene.traffic.states.values()])
    scene.entities.remove(state.entity.id, false);
  // Persisted exclusions isolate the new identity without replacing production
  // lane selection, random model choice, width admission or collision checks.
  scene.traffic.canSpawn = (identity) => identity.includes(":beetle:");
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
  expect(car.entity.type).toBe("vehicle-v1:beetle");
  expect(car.placed).not.toBe(true);
  expect(car.lane.width).toBeGreaterThanOrEqual(88);
  expect(car.entity.proceduralId).toContain("traffic-v1:");
});

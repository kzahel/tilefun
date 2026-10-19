import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
// @ts-expect-error pngjs has no bundled declarations
import { PNG } from "pngjs";
import { expect, it } from "vitest";
import { SPRITE_MANIFEST } from "../assets/GameAssets.js";
import { VEHICLE_PALETTE } from "../editor/EditorPalettes.js";
import { Direction } from "../entities/Entity.js";
import { authoredVehicleForType } from "../rendering/AuthoredVehicleMeshes.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import { ORIGINAL_VEHICLES } from "./OriginalVehicles.js";
import {
  createVehicle,
  TRAFFIC_MODELS,
  VEHICLE_BANK,
  vehicleRoadWidth,
  vehicleTurningRadius,
} from "./Vehicle.js";
import { vehiclePerformance } from "./VehiclePerformance.js";

it("ships the reviewed mesh with exact game-camera fallback pixels for every facing", () => {
  const definition = ORIGINAL_VEHICLES.find((vehicle) => vehicle.id === "rosso-coupe");
  if (!definition) throw Error("Missing coupe");
  const type = `vehicle-v1:${definition.id}`;
  const receipt = JSON.parse(
    readFileSync("art-source/vehicle-bake/runtime-rosso-coupe-v3.json", "utf8"),
  );
  const model = readFileSync(`public/${definition.mesh.path}`);
  expect(createHash("sha256").update(model).digest("hex")).toBe(receipt.modelSha256);
  expect(authoredVehicleForType(type)?.path).toBe(definition.mesh.path);
  expect(VEHICLE_BANK.views).toHaveLength(180);
  expect(TRAFFIC_MODELS).toContain(definition.id);
  expect(VEHICLE_PALETTE.find((entry) => entry.type === type)?.label).toBe("Red sports coupe");
  expect(SPRITE_MANIFEST.find((entry) => entry.key === type)?.path).toBe(definition.sprite);
  const sheet = PNG.sync.read(readFileSync(`public/${definition.sprite}`));
  expect([sheet.width, sheet.height]).toEqual([192, 896]);
  for (const [row, index] of [4, 12, 8, 0].entries()) {
    const frame = PNG.sync.read(
      readFileSync(
        `public/demos/vehicle-bake/captures/a-reduced-projection--mid-fenders-v3/engine-${index}.png`,
      ),
    );
    for (let y = 0; y < 128; y++) {
      const offset = ((row * 224 + 80 + y) * 192 + 32) * 4;
      expect(sheet.data.subarray(offset, offset + 128 * 4)).toEqual(
        frame.data.subarray(y * 128 * 4, (y + 1) * 128 * 4),
      );
    }
  }
  for (const facing of [Direction.Down, Direction.Up, Direction.Left, Direction.Right]) {
    const car = createVehicle(definition.id, 120, 240, facing);
    expect(car.collider?.physicalHeight).toBe(19);
    expect([car.collider?.width, car.collider?.height]).toEqual(
      facing === Direction.Left || facing === Direction.Right ? [82, 36] : [36, 82],
    );
    expect(deserializeEntity(serializeEntity(car)).collider).toEqual(car.collider);
  }
  expect(vehicleRoadWidth(type)).toBe(84);
  expect(vehicleTurningRadius(type)).toBeCloseTo(57.4);
  expect(vehiclePerformance(type).speed).toBeGreaterThan(
    vehiclePerformance("vehicle-v1:compact-1").speed,
  );
});

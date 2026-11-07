import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { AUTONOMOUS_ORIGINAL_VEHICLES } from "../../tests-support/AutonomousOriginalVehicles.fixture.js";
import { TRANSPORTER_EXPECTATIONS } from "../../tests-support/Transporter.fixture.js";
import { SPRITE_MANIFEST } from "../assets/GameAssets.js";
import { VEHICLE_PALETTE } from "../editor/EditorPalettes.js";
import { AUTHORED_VEHICLE_MESHES } from "../rendering/AuthoredVehicleMeshes.js";
import { ORIGINAL_VEHICLES } from "./OriginalVehicles.js";
import { DRIVABLE_MODELS, TRAFFIC_MODELS, VEHICLE_BANK, VEHICLE_MODELS } from "./Vehicle.js";

it("covers every active original with independent frozen expectations", () => {
  expect(ORIGINAL_VEHICLES.map((vehicle) => vehicle.id).sort()).toEqual(
    [
      ...AUTONOMOUS_ORIGINAL_VEHICLES.map((family) => family.model),
      TRANSPORTER_EXPECTATIONS.model,
    ].sort(),
  );
  for (const key of ["assetId", "modelPath", "spritePath", "modelSha256"] as const) {
    expect(new Set(AUTONOMOUS_ORIGINAL_VEHICLES.map((family) => family[key])).size).toBe(
      AUTONOMOUS_ORIGINAL_VEHICLES.length,
    );
  }
});

it("registers every combined model exactly once across editor, assets, traffic and own meshes", () => {
  expect(VEHICLE_MODELS).toHaveLength(
    new Set(VEHICLE_BANK.views.map((view) => view.vehicleId)).size + ORIGINAL_VEHICLES.length,
  );
  expect(new Set(VEHICLE_MODELS).size).toBe(VEHICLE_MODELS.length);
  expect(TRAFFIC_MODELS).toHaveLength(VEHICLE_MODELS.length - 1);
  expect(AUTHORED_VEHICLE_MESHES).toHaveLength(DRIVABLE_MODELS.length);
  for (const model of DRIVABLE_MODELS) {
    const type = `vehicle-v1:${model}`;
    expect(VEHICLE_PALETTE.filter((entry) => entry.type === type)).toHaveLength(1);
    expect(SPRITE_MANIFEST.filter((entry) => entry.key === type)).toHaveLength(1);
    expect(AUTHORED_VEHICLE_MESHES.filter((entry) => entry.vehicle === model)).toHaveLength(1);
  }
});

it("preserves the exact 45-type source bank", () => {
  expect(
    createHash("sha256").update(readFileSync("src/traffic/vehicles-v1.json")).digest("hex"),
  ).toBe("79cc6b59a727101304bde0beb7fe7e810703f3037ab9fcd4260334c55d8bf4c6");
  expect(new Set(VEHICLE_BANK.views.map((view) => view.vehicleId)).size).toBe(45);
});

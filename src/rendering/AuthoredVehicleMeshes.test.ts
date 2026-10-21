import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { BOAT_MESH, BOAT_MODEL } from "../boats/Boat.js";
import { ORIGINAL_VEHICLES } from "../traffic/OriginalVehicles.js";
import { DRIVABLE_MODELS } from "../traffic/Vehicle.js";
import { AUTHORED_VEHICLE_MESHES } from "./AuthoredVehicleMeshes.js";

it("registers every source type exactly once and consumes its latest retained export", () => {
  const catalog = JSON.parse(readFileSync("art-source/vehicle-models/catalog.json", "utf8")) as {
    bundles: { assetId: string; revision: string; glb: string }[];
  };
  const latest = new Map<string, (typeof catalog.bundles)[number]>();
  for (const bundle of catalog.bundles) {
    const old = latest.get(bundle.assetId);
    if (!old || Number(bundle.revision.slice(1)) > Number(old.revision.slice(1)))
      latest.set(bundle.assetId, bundle);
  }
  expect(new Set(AUTHORED_VEHICLE_MESHES.map((d) => d.vehicle))).toEqual(new Set(DRIVABLE_MODELS));
  expect(AUTHORED_VEHICLE_MESHES).toHaveLength(DRIVABLE_MODELS.length);
  expect(new Set(AUTHORED_VEHICLE_MESHES.map((d) => d.assetId)).size).toBe(DRIVABLE_MODELS.length);
  for (const definition of AUTHORED_VEHICLE_MESHES) {
    if (definition.vehicle === BOAT_MODEL) {
      expect(definition).toEqual(BOAT_MESH);
      continue;
    }
    const original = ORIGINAL_VEHICLES.find((vehicle) => vehicle.id === definition.vehicle);
    if (original) {
      expect(definition).toEqual({
        vehicle: original.id,
        ...original.mesh,
        ...(original.id === "tow-truck"
          ? {
              assetId: "tow-truck-authored-v2",
              path: "assets/models/vehicles/tow-truck-v2.glb",
              radius: 144,
            }
          : {}),
        ...(original.id === "dump-truck"
          ? {
              assetId: "dump-truck-authored-v2",
              path: "assets/models/vehicles/dump-truck-v2.glb",
              radius: 128,
            }
          : {}),
      });
      continue;
    }
    const bundle = latest.get(definition.vehicle);
    expect(bundle, definition.vehicle).toBeDefined();
    expect(definition.path).toBe(bundle?.glb.replace(/^public\//, ""));
    expect(definition.assetId).toBe(`${definition.vehicle}-authored-${bundle?.revision}`);
  }
});

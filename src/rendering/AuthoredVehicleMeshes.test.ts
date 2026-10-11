import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { VEHICLE_MODELS } from "../traffic/Vehicle.js";
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
  expect(new Set(AUTHORED_VEHICLE_MESHES.map((d) => d.vehicle))).toEqual(new Set(VEHICLE_MODELS));
  expect(AUTHORED_VEHICLE_MESHES).toHaveLength(VEHICLE_MODELS.length);
  expect(new Set(AUTHORED_VEHICLE_MESHES.map((d) => d.assetId)).size).toBe(VEHICLE_MODELS.length);
  for (const definition of AUTHORED_VEHICLE_MESHES) {
    const bundle = latest.get(definition.vehicle);
    expect(bundle, definition.vehicle).toBeDefined();
    expect(definition.path).toBe(bundle?.glb.replace(/^public\//, ""));
    expect(definition.assetId).toBe(`${definition.vehicle}-authored-${bundle?.revision}`);
  }
});

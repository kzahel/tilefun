// Read-only census of the current registered bank; never rewrites retained art.
// Run with: npx tsx scripts/instrumentation/vehicle-draw-census.mjs [OUTPUT.json]
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { AUTHORED_VEHICLE_MESHES } from "../../src/rendering/AuthoredVehicleMeshes.ts";

const root = path.resolve(import.meta.dirname, "../..");
const rows = [];
for (const model of AUTHORED_VEHICLE_MESHES) {
  const bytes = await readFile(path.join(root, "public", model.path));
  if (
    bytes.readUInt32LE(0) !== 0x46546c67 ||
    bytes.readUInt32LE(4) !== 2 ||
    bytes.readUInt32LE(16) !== 0x4e4f534a
  )
    throw Error(`Unsupported model container: ${model.path}`);
  const data = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  rows.push({
    vehicle: model.vehicle,
    path: model.path,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    parts: data.meshes.length,
    primitives: data.meshes.reduce((sum, mesh) => sum + mesh.primitives.length, 0),
    sourceMaterials: data.materials.length,
    alphaModes: data.materials.map((material) => material.alphaMode ?? "OPAQUE"),
    emergencyLenses: data.nodes.filter((node) => node.extras?.tilefun_role === "emergency-light")
      .length,
    animations: data.animations?.length ?? 0,
    skins: data.skins?.length ?? 0,
  });
}
const result = {
  schema: "tilefun-vehicle-draw-census/v1",
  limits:
    "Source primitive/material census, not measured GPU draws. Runtime emergency lenses clone materials and must remain independently controlled. Wheels retain their separate transforms.",
  models: rows.length,
  registrySHA256: createHash("sha256")
    .update(await readFile(path.join(root, "src/rendering/AuthoredVehicleMeshes.ts")))
    .digest("hex"),
  rows,
};
const json = `${JSON.stringify(result, null, 2)}\n`;
if (process.argv[2]) await writeFile(path.resolve(process.argv[2]), json);
else process.stdout.write(json);

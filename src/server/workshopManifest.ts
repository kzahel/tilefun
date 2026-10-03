import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { CHARACTERS } from "../characters/CharacterCatalog.js";
import type { WorkshopManifest } from "../workshop/WorkshopTypes.js";

/** Broad render inputs are intentional: renderer/physics edits must reopen affected
 * candidates through freshly computed pixels, not silently retain a stale bank.
 */
export async function workshopInputDigest(root = ".") {
  const files: string[] = [];
  const walk = async (directory: string, include: (path: string) => boolean) => {
    for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
      const path = directory + "/" + entry.name;
      if (entry.isDirectory()) await walk(path, include);
      else if (include(path)) files.push(path);
    }
  };
  await walk(
    "src",
    (p) =>
      (p.endsWith(".ts") || p.endsWith(".json") || p.endsWith(".png")) &&
      !p.endsWith(".test.ts") &&
      !p.startsWith("src/server/") &&
      !p.startsWith("src/workshop/") &&
      !p.endsWith("/main.ts") &&
      !["src/art/buildings.ts", "src/art/ArtNoteInbox.ts"].includes(p),
  );
  await walk("public/assets", (p) => p.endsWith(".png") || p.endsWith(".json"));
  files.push(...CHARACTERS.map((c) => `public/${c.image}`));
  files.push(
    "public/data/art-catalog.json",
    "public/data/modern-interiors-atlas.json",
    "src/workshop/ReviewCandidates.ts",
    "src/workshop/InteriorCandidates.ts",
    "src/workshop/PatternCandidates.ts",
    "src/workshop/ToolRegistry.ts",
    "src/workshop/VehicleCandidates.ts",
    "src/workshop/RailwayCandidates.ts",
    "src/workshop/CharacterCandidates.ts",
    "docs/research/vehicle-source-audit.json",
  );
  const hash = createHash("sha256");
  for (const path of files.sort()) {
    hash.update(path);
    hash.update("\0");
    hash.update(await readFile(join(root, path)));
    hash.update("\0");
  }
  return hash.digest("hex");
}
export async function loadWorkshopManifest(
  path = "public/data/workshop-manifest.json",
): Promise<WorkshopManifest> {
  const value = JSON.parse(await readFile(path, "utf8")) as WorkshopManifest;
  if (
    value.version !== 1 ||
    !Array.isArray(value.candidates) ||
    !Array.isArray(value.batches) ||
    !Array.isArray(value.tools)
  )
    throw new Error("Invalid Workshop manifest");
  return value;
}

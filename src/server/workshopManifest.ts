import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import boatReview from "../../public/demos/original-vehicles/explorer-boat-v1/review.json" with {
  type: "json",
};
import originalVehicles from "../../public/demos/original-vehicles/manifest.json" with {
  type: "json",
};
import vehicleBake from "../../public/demos/vehicle-bake/manifest.json" with { type: "json" };
import vehicleStyleStudy from "../../public/demos/vehicle-style-study/manifest.json" with {
  type: "json",
};
import { CHARACTERS } from "../characters/CharacterCatalog.js";
import wildlifeReviews from "../wildlife/reviews.json" with { type: "json" };
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
  // Only registered wildlife affects review freshness; unrelated draft authoring
  // must not invalidate exact existing candidates or race manifest generation.
  for (const draft of wildlifeReviews)
    files.push(
      ...[draft.sheet, draft.scene, draft.contact].map((sheet) => `public/${sheet.image}`),
    );
  files.push("public/demos/wildlife-v2/index.html", "public/demos/wildlife-v2/reviews.json");
  files.push(
    "public/demos/vehicle-style-study/manifest.json",
    "public/demos/vehicle-style-study/index.html",
    "public/demos/vehicle-style-study/gallery.js",
    "public/demos/vehicle-style-study/gallery.css",
    "src/workshop/VehicleStyleStudyCandidates.ts",
  );
  for (const route of vehicleStyleStudy.routes) {
    files.push(...route.files.map((file) => `public/${file.url}`));
  }
  files.push(
    "public/demos/vehicle-bake/manifest.json",
    "public/demos/vehicle-bake/index.html",
    "public/demos/vehicle-bake/review.css",
    "public/demos/vehicle-bake/viewer.js",
    "scripts/vehicle-bake/viewer.mjs",
    "src/workshop/VehicleBakeCandidates.ts",
  );
  for (const candidate of vehicleBake.candidates) {
    files.push(...candidate.files.map((file) => `public/${file.url}`));
  }
  files.push(
    "public/demos/original-vehicles/manifest.json",
    "public/demos/original-vehicles/index.html",
    "public/demos/original-vehicles/gallery.css",
    "public/demos/original-vehicles/gallery.js",
    "src/workshop/OriginalVehicleCandidates.ts",
    "public/demos/original-vehicles/explorer-boat-v1/review.json",
  );
  for (const candidate of [...originalVehicles.candidates, ...boatReview.candidates]) {
    files.push(...candidate.files.map((file) => `public/${file.url}`));
  }
  files.push(...CHARACTERS.map((c) => `public/${c.image}`));
  files.push(
    "public/data/art-catalog.json",
    "public/data/modern-interiors-atlas.json",
    "src/workshop/ReviewCandidates.ts",
    "src/workshop/InteriorCandidates.ts",
    "src/workshop/PatternCandidates.ts",
    "src/workshop/ParkingCandidates.ts",
    "src/workshop/ParkingVisitCandidate.ts",
    "src/scenarios/CityParkingRecipe.ts",
    "src/generation/regional/ParkingLayout.ts",
    "src/road/ParkingSurface.ts",
    "src/traffic/ShoppingCenter.ts",
    "src/generation/regional/ShoppingScenery.ts",
    "src/workshop/DoorCandidates.ts",
    "src/workshop/ToolRegistry.ts",
    "src/workshop/VehicleCandidates.ts",
    "src/workshop/CarProjectionCandidate.ts",
    "src/workshop/WorldGeometryCandidate.ts",
    "src/workshop/TruckBedCandidate.ts",
    "src/workshop/TruckBedPage.tsx",
    "src/workshop/TowingCandidate.ts",
    "src/workshop/TowingPage.tsx",
    "src/server/TowControl.ts",
    "art-source/vehicle-bake/towing-fallbacks/v2/recipe.json",
    "src/workshop/RailwayCandidates.ts",
    "src/workshop/CharacterCandidates.ts",
    "src/workshop/FamilySheetCandidates.ts",
    "public/data/family-sheets.json",
    "src/workshop/WildlifeCandidates.ts",
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

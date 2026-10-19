/** Build a separate family viewer; never touch the frozen coupe viewer. */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "vite";

const outDir = process.argv[2];
if (!outDir) throw Error("Usage: node scripts/vehicle-bake/family-build.mjs OUTPUT_DIRECTORY");
if (existsSync(resolve(outDir, "review-manifest.json")))
  throw Error("Frozen review revision: build into a new directory.");
await build({
  configFile: false,
  logLevel: "warn",
  publicDir: false,
  build: {
    outDir: resolve(outDir),
    emptyOutDir: false,
    lib: {
      entry: resolve("scripts/vehicle-bake/family-viewer.mjs"),
      name: "OriginalFamilyReview",
      formats: ["iife"],
      fileName: () => "viewer.js",
    },
    minify: true,
  },
});

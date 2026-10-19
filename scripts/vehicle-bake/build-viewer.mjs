import { resolve } from "node:path";
import { build } from "vite";

await build({
  configFile: false,
  logLevel: "warn",
  publicDir: false,
  build: {
    outDir: "public/demos/vehicle-bake",
    emptyOutDir: false,
    lib: {
      entry: resolve("scripts/vehicle-bake/viewer.mjs"),
      name: "VehicleBakeReview",
      formats: ["iife"],
      fileName: () => "viewer.js",
    },
    minify: true,
  },
});
console.log("Built self-contained shared-engine GLB viewer.");

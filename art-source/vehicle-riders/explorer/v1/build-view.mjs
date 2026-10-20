import { copyFile, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "vite";

const out = "public/demos/vehicle-riders/explorer/v1";
await build({
  configFile: false,
  logLevel: "warn",
  publicDir: false,
  build: {
    outDir: resolve(out),
    emptyOutDir: false,
    lib: {
      entry: resolve("scripts/vehicle-riders/explorer/viewer.mjs"),
      name: "SeatedExplorerPilot",
      formats: ["iife"],
      fileName: () => "viewer.js",
    },
    minify: true,
  },
});
await copyFile("scripts/vehicle-riders/explorer/index.html", `${out}/index.html`);
await copyFile("scripts/vehicle-riders/explorer/rider.json", `${out}/rider.json`);
const config = JSON.parse(await readFile(`${out}/rider.json`, "utf8"));
const assets = {};
for (const [key, path, mime] of [
  ["car", config.carControl.glb, "model/gltf-binary"],
  ["rider", `${out}/rider.glb`, "model/gltf-binary"],
  ["identity", config.identityReference.approvedPNG, "image/png"],
])
  assets[key] = `data:${mime};base64,${(await readFile(path)).toString("base64")}`;
const bundle = (await readFile(`${out}/viewer.js`, "utf8")).replaceAll("</script", "<\\/script");
const html = (await readFile(`${out}/index.html`, "utf8")).replace(
  '<script src="viewer.js"></script>',
  () =>
    `<script>window.riderOffline=${JSON.stringify({ config, assets })};</script><script>${bundle}</script>`,
);
await writeFile("data/vehicle-riders/explorer/offline.html", html);

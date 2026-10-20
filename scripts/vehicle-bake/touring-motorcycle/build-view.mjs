/** Own raw diagnostic packaging; no normal family catalog or shared review. */

import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { build } from "esbuild";

const s = "scripts/vehicle-bake/touring-motorcycle";
const o = "public/demos/vehicle-bake/touring-motorcycle/v1";
await mkdir(o, { recursive: true });
await build({
  entryPoints: [`${s}/raw-viewer.mjs`],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  outfile: `${o}/raw-viewer.js`,
  legalComments: "none",
  logLevel: "warning",
});
await copyFile(`${s}/raw-diagnostic.html`, `${o}/raw-diagnostic.html`);
await copyFile(
  "art-source/vehicle-riders/explorer-upright/v1/rider.glb",
  `${o}/rider-reference.glb`,
);
const assets = {};
for (const [id, name] of [
  ["bike", "model.glb"],
  ["rider", "rider-reference.glb"],
])
  assets[id] =
    `data:model/gltf-binary;base64,${(await readFile(`${o}/${name}`)).toString("base64")}`;
const config = JSON.parse(await readFile(`${o}/recipe.json`, "utf8"));
const bundle = (await readFile(`${o}/raw-viewer.js`, "utf8")).replaceAll("</script", "<\\/script");
const html = (await readFile(`${s}/raw-diagnostic.html`, "utf8")).replace(
  '<script type="module" src="raw-viewer.js"></script>',
  `<script>window.cycleOffline=${JSON.stringify({ assets, config }).replaceAll("<", "\\u003c")}</script><script type="module">${bundle}</script>`,
);
await writeFile(`${o}/offline-raw.html`, html);
console.log(
  JSON.stringify({
    status: "raw-diagnostic-built",
    normalCatalogUsed: false,
    CarMeshAssetUsed: false,
    output: o,
  }),
);

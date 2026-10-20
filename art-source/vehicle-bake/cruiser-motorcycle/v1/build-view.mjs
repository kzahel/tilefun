/** Own raw diagnostic packaging; no normal family catalog or shared review. */

import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { build } from "esbuild";

const s = "scripts/vehicle-bake/cruiser-motorcycle";
const o = "public/demos/vehicle-bake/cruiser-motorcycle/v1";
const d = "data/vehicle-bake/cruiser-motorcycle";
const sha = (value) => createHash("sha256").update(value).digest("hex");
const helpers = ["src/rendering/CarMeshProjection.ts", "src/rendering/CarPixelOutline.ts"];
const helperHashes = Object.fromEntries(
  await Promise.all(helpers.map(async (p) => [p, sha(await readFile(p))])),
);
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
const riderConfig = JSON.parse(await readFile(`${s}/family.json`, "utf8"));
await copyFile(riderConfig.rider.glbPath, `${o}/rider-reference.glb`);
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
  () =>
    `<script>window.cycleOffline=${JSON.stringify({ assets, config }).replaceAll("<", "\\u003c")}</script><script type="module">${bundle}</script>`,
);
await writeFile(`${o}/offline-raw.html`, html);
for (const p of helpers)
  if (sha(await readFile(p)) !== helperHashes[p])
    throw Error(`Shared input changed during bundle: ${p}`);
await writeFile(
  `${d}/diagnostic-bundle.json`,
  `${JSON.stringify(
    {
      status: "built-read-only-shared-projection-outline",
      helperHashes,
      bundleSha256: sha(await readFile(`${o}/raw-viewer.js`)),
      offlineSha256: sha(await readFile(`${o}/offline-raw.html`)),
      inputRiderSha256: sha(await readFile(`${o}/rider-reference.glb`)),
      actualSharedMotorcycleLoaderUsed: false,
      normalActivation: false,
    },
    null,
    2,
  )}\n`,
);
console.log(
  JSON.stringify({
    status: "raw-diagnostic-built",
    normalCatalogUsed: false,
    CarMeshAssetUsed: false,
    output: o,
  }),
);

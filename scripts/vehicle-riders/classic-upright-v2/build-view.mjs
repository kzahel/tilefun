import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "vite";

const base = "data/vehicle-riders/classic-upright-v2";
const out = `${base}/author-view`;
const pinPaths = [
  "scripts/vehicle-riders/classic-upright-v2/viewer.mjs",
  "scripts/vehicle-riders/classic-upright-v2/build-view.mjs",
  "scripts/vehicle-riders/classic-upright-v2/index.html",
  "scripts/vehicle-riders/classic-upright-v2/rider.json",
  "src/rendering/CarMeshProjection.ts",
  "scripts/vehicle-riders/classic-upright-v2/outline.ts",
  "package.json",
];
const hashes = async () =>
  Object.fromEntries(
    await Promise.all(
      pinPaths.map(async (p) => [
        p,
        createHash("sha256")
          .update(await readFile(p))
          .digest("hex"),
      ]),
    ),
  );
const before = await hashes();
await mkdir(out, { recursive: true });
await build({
  configFile: false,
  logLevel: "warn",
  cacheDir: resolve(`${base}/vite-build-cache`),
  publicDir: false,
  build: {
    outDir: resolve(out),
    emptyOutDir: false,
    lib: {
      entry: resolve("scripts/vehicle-riders/classic-upright-v2/viewer.mjs"),
      name: "ClassicUprightPrototype",
      formats: ["iife"],
      fileName: () => "viewer.js",
    },
    minify: true,
  },
});
for (const [from, to] of [
  ["scripts/vehicle-riders/classic-upright-v2/index.html", "index.html"],
  ["scripts/vehicle-riders/classic-upright-v2/rider.json", "rider.json"],
  ["public/demos/vehicle-riders/classic-upright/v2/rider.glb", "rider.glb"],
  [`${base}/synthetic-contact-fixture.glb`, "synthetic-contact-fixture.glb"],
  ["public/assets/sprites/player.png", "identity-reference.png"],
])
  await copyFile(from, `${out}/${to}`);
const config = JSON.parse(await readFile(`${out}/rider.json`, "utf8"));
for (const entry of config.scaleControls) await copyFile(entry.path, `${out}/${entry.viewerFile}`);
const assets = {};
for (const [id, name, mime] of [
  ["rider", "rider.glb", "model/gltf-binary"],
  ["fixture", "synthetic-contact-fixture.glb", "model/gltf-binary"],
  ["identity", "identity-reference.png", "image/png"],
])
  assets[id] = `data:${mime};base64,${(await readFile(`${out}/${name}`)).toString("base64")}`;
for (const entry of config.scaleControls)
  assets[entry.id] =
    `data:model/gltf-binary;base64,${(await readFile(`${out}/${entry.viewerFile}`)).toString("base64")}`;
const bundle = (await readFile(`${out}/viewer.js`, "utf8")).replaceAll("</script", "<\\/script");
const html = (await readFile(`${out}/index.html`, "utf8")).replace(
  '<script src="viewer.js"></script>',
  () =>
    `<script>window.riderOffline=${JSON.stringify({ config, assets })};</script><script>${bundle}</script>`,
);
await writeFile(`${base}/offline.html`, html);
const after = await hashes();
if (JSON.stringify(before) !== JSON.stringify(after))
  throw new Error("Diagnostic inputs changed during bundle construction");
await writeFile(
  `${base}/diagnostic-build-pins.json`,
  `${JSON.stringify(
    {
      status: "passed",
      before,
      after,
      noInputChangesDuringBuild: true,
      viewBundleSha256: createHash("sha256")
        .update(await readFile(`${out}/viewer.js`))
        .digest("hex"),
    },
    null,
    2,
  )}\n`,
);

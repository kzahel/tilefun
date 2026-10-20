import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "vite";

const base = "data/vehicle-riders/bear-upright";
const out = `${base}/author-view`;
await mkdir(out, { recursive: true });
await build({
  configFile: false,
  logLevel: "warn",
  publicDir: false,
  build: {
    outDir: resolve(out),
    emptyOutDir: false,
    lib: {
      entry: resolve("scripts/vehicle-riders/bear-upright/viewer.mjs"),
      name: "BearUprightPrototype",
      formats: ["iife"],
      fileName: () => "viewer.js",
    },
    minify: true,
  },
});
for (const [from, to] of [
  ["scripts/vehicle-riders/bear-upright/index.html", "index.html"],
  ["scripts/vehicle-riders/bear-upright/rider.json", "rider.json"],
  ["public/demos/vehicle-riders/bear-upright/v1/rider.glb", "rider.glb"],
  [`${base}/synthetic-contact-fixture.glb`, "synthetic-contact-fixture.glb"],
  ["public/demos/pixel-characters/bear-32.png", "identity-reference.png"],
])
  await copyFile(from, `${out}/${to}`);
const config = JSON.parse(await readFile(`${out}/rider.json`, "utf8"));
const assets = {};
for (const [id, name, mime] of [
  ["rider", "rider.glb", "model/gltf-binary"],
  ["fixture", "synthetic-contact-fixture.glb", "model/gltf-binary"],
  ["identity", "identity-reference.png", "image/png"],
])
  assets[id] = `data:${mime};base64,${(await readFile(`${out}/${name}`)).toString("base64")}`;
const bundle = (await readFile(`${out}/viewer.js`, "utf8")).replaceAll("</script", "<\\/script");
const html = (await readFile(`${out}/index.html`, "utf8")).replace(
  '<script src="viewer.js"></script>',
  () =>
    `<script>window.riderOffline=${JSON.stringify({ config, assets })};</script><script>${bundle}</script>`,
);
await writeFile(`${base}/offline.html`, html);

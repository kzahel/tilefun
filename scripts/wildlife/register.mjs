import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { ROOT, safeArtifact } from "./campaign.mjs";

const [
  animalId,
  revision,
  name,
  batchId,
  sheetFile = "sheet.png",
  sceneFile = "scene.png",
  contactFile = "contact-sheet.png",
  previewFile = "preview.gif",
] = process.argv.slice(2);
if (![animalId, revision, batchId].every((v) => /^[a-z0-9-]+$/.test(v ?? "")) || !name)
  throw new Error("Usage: register.mjs ANIMAL REVISION NAME BATCH [SHEET SCENE CONTACT PREVIEW]");
const base = `public/demos/wildlife-v2/${animalId}/${revision}`;
const fingerprint = (bytes) => createHash("sha256").update(bytes).digest("hex");
function pathFor(file) {
  const path = `${base}/${file}`;
  safeArtifact(ROOT, path);
  if (file.includes("/") || file.includes("\\") || file.includes(".."))
    throw new Error("Expected an artifact filename");
  return path;
}
function sheet(file, suffix) {
  const path = pathFor(file),
    bytes = readFileSync(resolve(ROOT, path));
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    throw new Error("Expected a PNG");
  return {
    id: `wildlife-v2-${animalId}-${revision}${suffix}`,
    name: `${name} ${suffix || "sheet"}`,
    image: path.replace(/^public\//, ""),
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    tileSize: 16,
    fingerprint: fingerprint(bytes),
    source: `art-source/wildlife-v2/${animalId}/${revision}`,
  };
}
const extras = [
  "index.html",
  "playback.js",
  "scene-background.png",
  "preview-native.gif",
  "scene-native.gif",
];
const files = [
  ...new Set([
    sheetFile,
    sceneFile,
    contactFile,
    previewFile,
    "sprite.json",
    ...extras.filter((file) => existsSync(resolve(ROOT, pathFor(file)))),
  ]),
].map((file) => {
  const path = pathFor(file);
  return {
    path: path.replace(/^public\//, ""),
    sha256: fingerprint(readFileSync(resolve(ROOT, path))),
  };
});
const entry = {
  id: `${animalId}-${revision}`,
  animalId,
  revision,
  name,
  batchId,
  galleryUrl: `/tilefun/demos/wildlife-v2/${animalId}/${revision}/`,
  sheet: sheet(sheetFile, ""),
  scene: sheet(sceneFile, "-scene"),
  contact: sheet(contactFile, "-contact"),
  preview: pathFor(previewFile).replace(/^public\//, ""),
  files,
};
const registryPath = resolve(ROOT, "src/wildlife/reviews.json");
const registry = JSON.parse(readFileSync(registryPath, "utf8"));
const previous = registry.find((d) => d.id === entry.id);
if (previous && JSON.stringify(previous) !== JSON.stringify(entry))
  throw new Error("Registered pixels are immutable; use a new revision");
if (!previous) {
  if (registry.filter((d) => d.batchId === batchId).length >= 4)
    throw new Error("A wildlife batch holds at most four drafts");
  registry.push(entry);
  writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
}
writeFileSync(
  resolve(ROOT, "public/demos/wildlife-v2/reviews.json"),
  `${JSON.stringify(registry, null, 2)}\n`,
);
console.log(`Registered pending exact draft ${entry.id} in ${relative(ROOT, registryPath)}`);

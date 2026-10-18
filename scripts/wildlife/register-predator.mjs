// Register a new, inspected revision once. Existing identities are immutable.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PNG } from "pngjs";

const species = process.argv[2];
const names = { panther: "Panther", lion: "Lion", "brown-bear": "Brown bear" };
assert(names[species], "Choose one of the three explicitly authorized new predators.");
const source = `art-source/wildlife-v2/${species}/hunt-v1`;
const publicBase = `public/demos/wildlife-v2/${species}/hunt-v1`;
const identity = `${species}-hunt-v1`;
const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const hash = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
assert(!existsSync(`${source}/receipt.json`), "Registered revisions cannot be overwritten.");
const audit = read(`${publicBase}/source-audit.json`);
assert.equal(audit.poses, 116);
assert.equal(audit.fixedLengthLinkChecks, 1392);
assert.equal(audit.plantedGroundContacts, 432);
const capture = read(`data/predators-132/${species}/browser/capture.json`);
assert.equal(capture.results.length, 2);
for (const result of capture.results) {
  assert.equal(result.chronologicalPoses, 29);
  assert.equal(result.exactCropChecks, 116);
  assert.deepEqual(result.errors, []);
}
const replay = read(`data/predators-132/${species}-replay-result.json`);
assert.equal(replay.status, "byte-identical");
assert(readFileSync(`${publicBase}/review-observations.md`, "utf8").length > 800);
const registryPath = "src/wildlife/reviews.json";
const original = readFileSync(registryPath, "utf8");
const registry = JSON.parse(original);
assert(!registry.some((r) => r.id === identity));
const sheet = (filename, suffix) => {
  const path = `${publicBase}/${filename}`;
  const png = PNG.sync.read(readFileSync(path));
  return {
    id: `wildlife-v2-${identity}${suffix ? `-${suffix}` : ""}`,
    name: `${names[species]} ${suffix || "sheet"}`,
    image: path.slice(7),
    width: png.width,
    height: png.height,
    tileSize: 16,
    fingerprint: hash(path),
    source,
  };
};
const publicFiles = readdirSync(publicBase).sort();
const row = {
  id: identity,
  animalId: species,
  revision: "hunt-v1",
  name: names[species],
  batchId: "wildlife-v2-predators-132",
  galleryUrl: `/tilefun/demos/wildlife-v2/${species}/hunt-v1/`,
  sheet: sheet("sheet.png", ""),
  scene: sheet("scene-native.png", "scene"),
  contact: sheet("contact-sheet-native.png", "contact"),
  preview: `${publicBase.slice(7)}/preview.gif`,
  files: publicFiles.map((file) => ({
    path: `${publicBase.slice(7)}/${file}`,
    sha256: hash(`${publicBase}/${file}`),
  })),
};
// Preserve all old objects/Unicode bytes exactly, appending only the new row.
const prefix = original.trimEnd();
assert(prefix.endsWith("\n]"));
const updated = `${prefix.slice(0, -2)},\n${JSON.stringify(row, null, 2)
  .split("\n")
  .map((s) => `  ${s}`)
  .join("\n")}\n]\n`;
assert.deepEqual(JSON.parse(updated).slice(0, registry.length), registry);
const paths = [
  ...readdirSync(source)
    .filter((f) => !f.endsWith(".blend1"))
    .map((f) => `${source}/${f}`),
  ...publicFiles.map((f) => `${publicBase}/${f}`),
  "art-source/wildlife-v2/camera.json",
  "scripts/wildlife/register-predator.mjs",
  "public/assets/tilesets/me-complete.png",
  "public/demos/pixel-characters/person-32.png",
  "public/demos/wildlife-v2/elephant/pilot-v2/sheet.png",
  "public/demos/wildlife-v2/elephant/pilot-v2/sprite.json",
];
const receipt = {
  identity,
  status: "draft-ready",
  reviewStatus: "pending",
  motionContract: "body-motion-20261004",
  sourceAudit: audit,
  capture,
  replay,
  visualReview: { observer: "coordinator", observations: `${publicBase}/review-observations.md` },
  artifacts: Object.fromEntries(paths.map((p) => [p, hash(p)])),
};
writeFileSync(`${source}/receipt.json`, `${JSON.stringify(receipt, null, 2)}\n`);
writeFileSync(registryPath, updated);
writeFileSync("public/demos/wildlife-v2/reviews.json", updated);
const ignore = "public/demos/wildlife-v2/.gitignore";
writeFileSync(
  ignore,
  `${readFileSync(ignore, "utf8").trimEnd()}\n\n# Predator 132: complete portable ${species} review bundle.\n${publicFiles.map((f) => `!${species}/hunt-v1/${f}`).join("\n")}\n`,
);
console.log(
  JSON.stringify({
    identity,
    artifacts: paths.length,
    publicFiles: publicFiles.length,
    reviewStatus: "pending",
    root: resolve("."),
  }),
);

// Register only this new pending clay study, preserving every prior review row.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";

const source = "art-source/wildlife-v2/horse/motion-study-v3";
const base = "public/demos/wildlife-v2/horse/motion-study-v3";
const identity = "horse-motion-study-v3";
const hash = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const read = (path) => JSON.parse(readFileSync(path, "utf8"));
assert(!existsSync(`${source}/receipt.json`), "Registered study is immutable; use a new revision.");
const audit = read(`${base}/source-audit.json`);
const validation = read(`${base}/validation.json`);
assert.equal(audit.poses, 128);
assert.equal(validation.chronologicalPoses, 96);
assert.equal(validation.exactNativeCrops, 384);
assert.deepEqual(validation.errors, []);
const registryPath = "src/wildlife/reviews.json";
const original = readFileSync(registryPath, "utf8");
const rows = JSON.parse(original);
assert(!rows.some((r) => r.id === identity));
const sheet = (file, suffix) => {
  const path = `${base}/${file}`,
    png = PNG.sync.read(readFileSync(path));
  return {
    id: `wildlife-v2-${identity}${suffix ? `-${suffix}` : ""}`,
    name: `Horse clay study ${suffix || "sheet"}`,
    image: path.slice(7),
    width: png.width,
    height: png.height,
    tileSize: 16,
    fingerprint: hash(path),
    source,
  };
};
const files = readdirSync(base).sort();
const row = {
  id: identity,
  animalId: "horse",
  revision: "motion-study-v3",
  name: "Horse anatomy and motion · clay study v3",
  batchId: "wildlife-v2-horse-motion-139",
  galleryUrl: "/tilefun/demos/wildlife-v2/horse/motion-study-v3/",
  sheet: sheet("sheet.png", ""),
  scene: sheet("scene-native.png", "scene"),
  contact: sheet("contact-sheet-native.png", "contact"),
  preview: `${base.slice(7)}/preview.gif`,
  files: files.map((f) => ({ path: `${base.slice(7)}/${f}`, sha256: hash(`${base}/${f}`) })),
};
const prefix = original.trimEnd();
assert(prefix.endsWith("\n]"));
const updated = `${prefix.slice(0, -2)},\n${JSON.stringify(row, null, 2)
  .split("\n")
  .map((s) => `  ${s}`)
  .join("\n")}\n]\n`;
assert.deepEqual(JSON.parse(updated).slice(0, rows.length), rows);
const paths = [
  ...readdirSync(source)
    .filter((f) => !f.endsWith(".blend1"))
    .map((f) => `${source}/${f}`),
  ...files.map((f) => `${base}/${f}`),
  "art-source/wildlife-v2/camera.json",
  "art-source/wildlife-v2/horse/draft-v1/horse.blend",
];
const receipt = {
  identity,
  status: "clay-prototype-ready",
  reviewStatus: "pending",
  gameArtReplaced: false,
  motionContract: "body-motion-20261004",
  scope: "Focused owner-authorized horse study; historical broad gates unchanged",
  audit: {
    poses: audit.poses,
    fixedLengthLinkChecks: audit.fixedLengthLinkChecks,
    plantedGroundContacts: audit.plantedGroundContacts,
    plantedTravelPairs: audit.plantedTravelPairs,
    bodyVerticalRangePixels: audit.bodyVerticalRangePixels,
  },
  validation,
  artifacts: Object.fromEntries(paths.map((p) => [p, hash(p)])),
};
writeFileSync(`${source}/receipt.json`, `${JSON.stringify(receipt, null, 2)}\n`);
writeFileSync(registryPath, updated);
writeFileSync("public/demos/wildlife-v2/reviews.json", updated);
const ignore = "public/demos/wildlife-v2/.gitignore";
writeFileSync(
  ignore,
  `${readFileSync(ignore, "utf8").trimEnd()}\n\n# Focused owner-authorized horse motion study 139, pending human review.\n${files.map((f) => `!horse/motion-study-v3/${f}`).join("\n")}\n`,
);
console.log(JSON.stringify({ identity, files: files.length, reviewStatus: "pending" }));

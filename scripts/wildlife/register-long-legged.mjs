// New exact repair identities only; preserve every previous row and bank.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";

const hash = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const registryPath = "src/wildlife/reviews.json";
const original = readFileSync(registryPath, "utf8");
const existing = JSON.parse(original);
const rows = [];
const replay = read("data/long-legged-replay.json");
for (const species of ["horse", "giraffe"]) {
  const source = `art-source/wildlife-v2/${species}/motion-v2`;
  const base = `public/demos/wildlife-v2/${species}/motion-v2`;
  const identity = `${species}-motion-v2`;
  assert(!existsSync(`${source}/receipt.json`), "Registered repair is immutable");
  assert(!existing.some((r) => r.id === identity));
  const audit = read(`${base}/source-audit.json`);
  const pixel = read(`${base}/pixel-audit.json`);
  const validation = read(`${base}/validation.json`);
  assert.equal(audit.allClipPoses, 164);
  assert.equal(audit.continuousSamplesPerFacing, 65);
  assert(audit.fixedLengthLinkChecks >= 2000);
  assert(audit.plantedTravelPairs >= 300);
  assert(Object.values(pixel.bodyPaintCentroidRangePixels).every((v) => v >= 1));
  assert.equal(replay.find((r) => r.species === species)?.status, "byte-identical");
  assert.equal(validation.results.length, 2);
  assert(validation.results.every((r) => r.exactFacingCrops === 164));
  assert.deepEqual(validation.errors, []);
  const sheet = (file, suffix) => {
    const path = `${base}/${file}`;
    const png = PNG.sync.read(readFileSync(path));
    return {
      id: `wildlife-v2-${identity}${suffix ? `-${suffix}` : ""}`,
      name: `${species} repaired ${suffix || "sheet"}`,
      image: path.slice(7),
      width: png.width,
      height: png.height,
      tileSize: 16,
      fingerprint: hash(path),
      source,
    };
  };
  const files = readdirSync(base).sort();
  rows.push({
    id: identity,
    animalId: species,
    revision: "motion-v2",
    name: `${species === "horse" ? "Horse" : "Giraffe"} · completed motion repair`,
    batchId: "wildlife-v2-long-legged-139",
    galleryUrl: `/tilefun/demos/wildlife-v2/${species}/motion-v2/`,
    sheet: sheet("sheet.png", ""),
    scene: sheet("scene-native.png", "scene"),
    contact: sheet("contact-sheet-native.png", "contact"),
    preview: `${base.slice(7)}/preview.gif`,
    files: files.map((f) => ({ path: `${base.slice(7)}/${f}`, sha256: hash(`${base}/${f}`) })),
  });
  const paths = [
    ...readdirSync(source)
      .filter((f) => !f.endsWith(".blend1"))
      .map((f) => `${source}/${f}`),
    ...files.map((f) => `${base}/${f}`),
    `art-source/wildlife-v2/${species}/draft-v1/${species}.blend`,
    `art-source/wildlife-v2/${species}/draft-v1/masters.json`,
    "art-source/wildlife-v2/camera.json",
    "scripts/wildlife/capture-long-legged.mjs",
    "scripts/wildlife/register-long-legged.mjs",
  ];
  const receipt = {
    identity,
    status: "finished-game-active",
    reviewStatus: "pending final pixels",
    authorization:
      "Owner accepted horse-motion-study-v3 and explicitly authorized completing and activating horse/giraffe, then committing",
    motionContract: "body-motion-20261004",
    sourceAudit: audit,
    pixelAudit: pixel,
    validation,
    replay: replay.find((r) => r.species === species),
    artifacts: Object.fromEntries(paths.map((p) => [p, hash(p)])),
  };
  writeFileSync(`${source}/receipt.json`, `${JSON.stringify(receipt, null, 2)}\n`);
}
const prefix = original.trimEnd();
assert(prefix.endsWith("\n]"));
const updated = `${prefix.slice(0, -2)},\n${rows
  .map((row) =>
    JSON.stringify(row, null, 2)
      .split("\n")
      .map((s) => `  ${s}`)
      .join("\n"),
  )
  .join(",\n")}\n]\n`;
assert.deepEqual(JSON.parse(updated).slice(0, existing.length), existing);
writeFileSync(registryPath, updated);
writeFileSync("public/demos/wildlife-v2/reviews.json", updated);
console.log(
  JSON.stringify({ identities: rows.map((r) => r.id), reviewStatus: "pending final pixels" }),
);

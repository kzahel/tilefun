// Explicit owner-requested gorilla shoulder revision; independent of the expired run.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";

const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const hash = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const ledger = {
  identity: "owner-gorilla-shoulder-study-2026-10-19",
  tasks: { gorilla: { name: "Gorilla", state: "in-progress", revision: "shoulder-study-v1" } },
};
const animals = ["gorilla"];
assert(animals.length && new Set(animals).size === animals.length);
const path = "src/wildlife/reviews.json";
const original = readFileSync(path, "utf8");
const existing = JSON.parse(original);
const rows = [],
  receipts = [];
for (const animal of animals) {
  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(animal));
  const task = ledger.tasks[animal];
  assert.equal(task?.state, "in-progress");
  const revision = task.revision;
  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(revision));
  const source = `art-source/wildlife-v2/${animal}/${revision}`;
  const base = `public/demos/wildlife-v2/${animal}/${revision}`;
  const identity = `${animal}-${revision}`;
  assert(!existsSync(`${source}/receipt.json`), "Registered identity is immutable");
  assert(!existing.some((r) => r.id === identity));
  const metadata = read(`${base}/sprite.json`);
  const audit = read(`${base}/source-audit.json`),
    pixel = read(`${base}/pixel-audit.json`);
  const validation = read(`${base}/validation.json`);
  const replay = read(`data/wildlife-140/${animal}/${revision}/replay.json`);
  const expected = Object.values(metadata.clips).reduce((n, c) => n + c.count, 0) * 4;
  assert.equal(audit.allClipPoses, expected);
  assert.equal(pixel.poses, expected);
  assert(Object.keys(audit.meshLocalGeometrySha256).length > 0);
  if (metadata.clips.walk) {
    assert(audit.continuousSamplesPerFacing >= metadata.clips.walk.count * 2 + 1);
    assert(audit.fixedLengthLinkChecks > 0 && audit.plantedTravelPairs > 0);
    assert(audit.maxContactSlideWorldUnits < 0.0001);
    assert(Object.values(pixel.bodyPaintCentroidRangePixels).every((v) => v >= 1));
  }
  assert(pixel.binaryAlpha && pixel.fixedPalette && pixel.minimumPadding >= 2);
  assert.equal(replay.status, "byte-identical");
  assert.equal(validation.results.length, 2);
  assert(validation.results.every((r) => r.exactFacingCrops === expected));
  assert.deepEqual(validation.errors, []);
  const sheet = (file, suffix) => {
    const p = `${base}/${file}`,
      image = PNG.sync.read(readFileSync(p));
    return {
      id: `wildlife-v2-${identity}${suffix ? `-${suffix}` : ""}`,
      name: `${task.name} ${suffix || "sheet"}`,
      image: p.slice(7),
      width: image.width,
      height: image.height,
      tileSize: 16,
      fingerprint: hash(p),
      source,
    };
  };
  const files = readdirSync(base).sort();
  rows.push({
    id: identity,
    animalId: animal,
    revision,
    name: `${task.name} · shoulder study`,
    batchId: "wildlife-v2-gorilla-shoulder-study",
    galleryUrl: `/tilefun/demos/wildlife-v2/${animal}/${revision}/`,
    sheet: sheet("sheet.png", ""),
    scene: sheet("scene-native.png", "scene"),
    contact: sheet("contact-sheet-native.png", "contact"),
    preview: `${base.slice(7)}/preview.gif`,
    files: files.map((f) => ({ path: `${base.slice(7)}/${f}`, sha256: hash(`${base}/${f}`) })),
  });
  const inputs = read(`${source}/inputs.json`).files;
  assert(inputs.every((p) => p.startsWith("art-source/wildlife-v2/") && !p.includes("..")));
  const artifacts = [
    ...readdirSync(source)
      .filter((f) => !f.endsWith(".blend1"))
      .map((f) => `${source}/${f}`),
    ...files.map((f) => `${base}/${f}`),
    ...inputs,
    "scripts/wildlife/capture-motion-v2.mjs",
    "scripts/wildlife/replay-motion-v2.py",
  ];
  receipts.push([
    `${source}/receipt.json`,
    {
      identity,
      status: "review-ready",
      reviewStatus: "pending",
      authorization: ledger.identity,
      sourceAudit: audit,
      pixelAudit: pixel,
      validation,
      replay,
      artifacts: Object.fromEntries(artifacts.map((p) => [p, hash(p)])),
    },
  ]);
}
const prefix = original.trimEnd();
assert(prefix.endsWith("\n]"));
const updated = `${prefix.slice(0, -2)},\n${rows
  .map((r) =>
    JSON.stringify(r, null, 2)
      .split("\n")
      .map((s) => `  ${s}`)
      .join("\n"),
  )
  .join(",\n")}\n]\n`;
assert.deepEqual(JSON.parse(updated).slice(0, existing.length), existing);
for (const [p, receipt] of receipts) writeFileSync(p, `${JSON.stringify(receipt, null, 2)}\n`);
writeFileSync(path, updated);
writeFileSync("public/demos/wildlife-v2/reviews.json", updated);
const ignore = "public/demos/wildlife-v2/.gitignore";
writeFileSync(
  ignore,
  `${readFileSync(ignore, "utf8").trimEnd()}\n\n# Owner-requested gorilla shoulder study, pending human review.\n${animals.map((a) => `!${a}/${ledger.tasks[a].revision}/*`).join("\n")}\n`,
);
console.log(JSON.stringify({ identities: rows.map((r) => r.id), reviewStatus: "pending" }));

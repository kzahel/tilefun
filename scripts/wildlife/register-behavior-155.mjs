// Register exact pending identities for the three owner-authorized behaviors.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";

const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const hash = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const path = "src/wildlife/reviews.json",
  original = readFileSync(path, "utf8"),
  existing = read(path);
const rows = [],
  receipts = [];
for (const [animal, name] of [
  ["dog", "Dog fetch actions"],
  ["crow", "Crow gathering and nesting"],
  ["red-squirrel", "Red squirrel caching and eating"],
  ["foraging-resources", "Foraging materials, nests and caches"],
]) {
  const revision = "behavior-v1",
    identity = `${animal}-${revision}`;
  const source = `art-source/wildlife-v2/${animal}/${revision}`,
    base = `public/demos/wildlife-v2/${animal}/${revision}`;
  assert(!existsSync(`${source}/receipt.json`), "Registered identity is immutable");
  assert(!existing.some((r) => r.id === identity));
  const pixel = read(`${base}/pixel-audit.json`);
  assert(pixel.binaryAlpha);
  const replay =
    animal === "foraging-resources"
      ? read(`${source}/replay.json`)
      : read(`data/wildlife-155/${animal}/${revision}/replay.json`);
  assert.equal(replay.status, "byte-identical");
  let validation, audit;
  if (animal !== "foraging-resources") {
    const descriptor = read(`${base}/sprite.json`);
    const poses = Object.values(descriptor.clips).reduce((n, c) => n + c.count, 0) * 4;
    audit = read(`${base}/source-audit.json`);
    validation = read(`${base}/validation.json`);
    assert.equal(pixel.poses, poses);
    assert.equal(audit.allClipPoses, poses);
    assert(Object.keys(audit.meshLocalGeometrySha256).length > 0);
    assert(validation.results.every((r) => r.exactFacingCrops === poses));
    assert.deepEqual(validation.errors, []);
  } else assert.equal(pixel.distinctNestStages, 5);
  const sheet = (file, suffix) => {
    const p = `${base}/${file}`,
      image = PNG.sync.read(readFileSync(p));
    return {
      id: `wildlife-v2-${identity}${suffix ? `-${suffix}` : ""}`,
      name: `${name} ${suffix || "sheet"}`,
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
    name,
    batchId: "wildlife-v2-behaviors-155",
    galleryUrl: `/tilefun/demos/wildlife-v2/${animal}/${revision}/`,
    sheet: sheet("sheet.png", ""),
    scene: sheet("scene-native.png", "scene"),
    contact: sheet("contact-sheet-native.png", "contact"),
    preview: `${base.slice(7)}/${animal === "foraging-resources" ? "preview.png" : "preview.gif"}`,
    files: files.map((f) => ({ path: `${base.slice(7)}/${f}`, sha256: hash(`${base}/${f}`) })),
  });
  const walk = (directory) =>
    readdirSync(directory, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(`${directory}/${e.name}`) : [`${directory}/${e.name}`],
    );
  const artifacts = [
    ...walk(source).filter(
      (p) =>
        (!p.endsWith(".blend1") && !p.endsWith("/projection.json")) ||
        (!p.includes("/dog/") && p.endsWith("/projection.json")),
    ),
    ...files.map((f) => `${base}/${f}`),
    "scripts/wildlife/register-behavior-155.mjs",
    "scripts/wildlife/capture-behavior-155.mjs",
    "scripts/wildlife/replay-behavior-155.py",
    "scripts/wildlife/build-foraging-resources.py",
    "scripts/wildlife/behavior-art.mjs",
  ];
  receipts.push([
    `${source}/receipt.json`,
    {
      identity,
      status: "finished",
      reviewStatus: "pending",
      authorization: "docs/tactical/155-fetch-nests-and-caches.md",
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
  `${readFileSync(ignore, "utf8").trimEnd()}\n\n# Pending behavior batch 155, owner-authorized.\n${rows.map((r) => `!${r.animalId}/${r.revision}/*`).join("\n")}\n`,
);
console.log(JSON.stringify({ registered: rows.map((r) => r.id), reviewStatus: "pending" }));

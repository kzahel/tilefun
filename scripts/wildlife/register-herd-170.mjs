// Explicit exact-source pending review registration. Never run during a build.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";

const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const hash = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const path = "src/wildlife/reviews.json",
  original = readFileSync(path, "utf8"),
  existing = JSON.parse(original),
  rows = [];
const helpers = ["build.py", "finish.py", "replay.py", "resources.py", "art.mjs"].map(
  (n) => `scripts/wildlife/herd-${n}`,
);
for (const [animal, revision, label] of [
  ["cow", "behavior-v1", "Cow grazing and resting rumination"],
  ["sheep", "behavior-v1", "Sheep flock regrouping and bleating"],
  ["donkey", "behavior-v1", "Donkey supported dust bathing"],
  ["foraging-resources", "behavior-v7", "Reusable dust-bathing patch stages"],
]) {
  const identity = `${animal}-${revision}`,
    source = `art-source/wildlife-v2/${animal}/${revision}`,
    base = `public/demos/wildlife-v2/${animal}/${revision}`;
  assert(
    !existsSync(`${source}/receipt.json`) && !existing.some((r) => r.id === identity),
    "Registered banks are immutable",
  );
  const pixel = read(`${base}/pixel-audit.json`);
  assert(pixel.binaryAlpha);
  const replay = read(`${source}/replay.json`);
  assert.equal(replay.status, "byte-identical");
  if (animal !== "foraging-resources") {
    assert(read(`${base}/source-audit.json`).savedSourceIndependentlyChecked);
    assert(read(`${base}/validation.json`).results.every((r) => r.exactFacingCrops > 0));
    assert.deepEqual(read(`${base}/validation.json`).errors, []);
  }
  const sheet = (file, suffix) => {
    const p = `${base}/${file}`,
      image = PNG.sync.read(readFileSync(p));
    return {
      id: `wildlife-v2-${identity}${suffix ? `-${suffix}` : ""}`,
      name: `${label} ${suffix || "sheet"}`,
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
    name: label,
    batchId: "wildlife-v2-behaviors-170",
    galleryUrl: `/tilefun/demos/wildlife-v2/${animal}/${revision}/`,
    sheet: sheet("sheet.png", ""),
    scene: sheet("scene-native.png", "scene"),
    contact: sheet("contact-sheet-native.png", "contact"),
    preview: `${base.slice(7)}/${animal === "foraging-resources" ? "preview.png" : "preview.gif"}`,
    files: files.map((f) => ({ path: `${base.slice(7)}/${f}`, sha256: hash(`${base}/${f}`) })),
  });
  const inputs = Object.keys(read(`${source}/inputs.json`).sha256);
  const artifacts = [
    ...readdirSync(source)
      .filter((n) => !n.endsWith(".blend1"))
      .map((n) => `${source}/${n}`),
    ...files.map((n) => `${base}/${n}`),
    ...helpers,
    "scripts/wildlife/register-herd-170.mjs",
    "scripts/wildlife/capture-behavior-155.mjs",
    "art-source/wildlife-v2/camera.json",
    "public/demos/pixel-characters/person-32.png",
    ...inputs,
  ];
  writeFileSync(
    `${source}/receipt.json`,
    `${JSON.stringify({ identity, status: "finished", reviewStatus: "pending", authorization: "docs/tactical/170-rumination-flocks-and-dust-baths.md", replay, artifacts: Object.fromEntries(artifacts.map((p) => [p, hash(p)])) }, null, 2)}\n`,
  );
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
writeFileSync(path, updated);
writeFileSync("public/demos/wildlife-v2/reviews.json", updated);
const ignore = "public/demos/wildlife-v2/.gitignore";
writeFileSync(
  ignore,
  `${readFileSync(ignore, "utf8").trimEnd()}\n\n# Owner-authorized behavior batch 170.\n${rows.map((r) => `!${r.animalId}/${r.revision}/*`).join("\n")}\n`,
);
console.log(JSON.stringify({ registered: rows.map((r) => r.id), reviewStatus: "pending" }));

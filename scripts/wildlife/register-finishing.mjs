// Register exact new correction banks. Never invoked by an ordinary build.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";

const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const hash = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const original = readFileSync("src/wildlife/reviews.json", "utf8");
const existing = JSON.parse(original);
const contracts = read("art-source/wildlife-v2/finishing.json");
const rows = [];
const receipts = [];
for (const contract of contracts.animals.filter((entry) => entry.policy !== "retained-bank")) {
  const identity = `${contract.id}-${contract.revision}`;
  const source = `art-source/wildlife-v2/${contract.id}/${contract.revision}`;
  const base = `public/demos/wildlife-v2/${contract.id}/${contract.revision}`;
  assert(
    !existsSync(`${source}/receipt.json`) && !existing.some((row) => row.id === identity),
    "Registered banks are immutable",
  );
  const metadata = read(`${base}/sprite.json`);
  const prior = read(`public/${contract.sourceImage.replace("sheet.png", "sprite.json")}`);
  assert.equal(hash(`public/${contract.sourceImage}`), contract.sourceSha256);
  assert.deepEqual(metadata.clips, prior.clips);
  assert.deepEqual(metadata.anchor, prior.anchor);
  assert.equal(metadata.finishing.policy, contracts.policy);
  assert.equal(metadata.finishing.method, contract.policy);
  assert.equal(metadata.sheetSha256, hash(`${base}/sheet.png`));
  const inputs = read(`${source}/inputs.json`);
  for (const [path, expected] of Object.entries(inputs.sha256))
    assert.equal(hash(path), expected, path);
  const replay = read(`${source}/replay.json`);
  assert.equal(replay.status, "byte-identical");
  assert.equal(replay.isolation, "declared inputs only");
  for (const [file, expected] of Object.entries(replay.artifacts))
    assert.equal(hash(`${base}/${file}`), expected, file);
  const pixels = read(`${base}/pixel-audit.json`);
  assert(pixels.binaryAlpha && pixels.noExteriorAlphaGrowth && pixels.geometryAndMotionUnchanged);
  assert(Object.keys(read(`${base}/source-audit.json`).editableScenes).length);
  const sheet = (file, suffix) => {
    const path = `${base}/${file}`;
    const image = PNG.sync.read(readFileSync(path));
    return {
      id: `wildlife-v2-${identity}${suffix ? `-${suffix}` : ""}`,
      name: `${contract.name} ${suffix || "sheet"}`,
      image: path.slice(7),
      width: image.width,
      height: image.height,
      tileSize: 16,
      fingerprint: hash(path),
      source,
    };
  };
  const files = readdirSync(base).sort();
  rows.push({
    id: identity,
    animalId: contract.id,
    revision: contract.revision,
    name: `${contract.name} · consistent native paint`,
    batchId: "wildlife-v2-finishing-187",
    galleryUrl: `/tilefun/demos/wildlife-v2/${contract.id}/${contract.revision}/`,
    sheet: sheet("sheet.png", ""),
    scene: sheet("scene-native.png", "scene"),
    contact: sheet("contact-sheet-native.png", "contact"),
    preview: `${base.slice(7)}/preview.gif`,
    files: files.map((file) => ({
      path: `${base.slice(7)}/${file}`,
      sha256: hash(`${base}/${file}`),
    })),
  });
  const artifacts = new Set([
    ...Object.keys(inputs.sha256),
    ...readdirSync(source).map((file) => `${source}/${file}`),
    ...files.map((file) => `${base}/${file}`),
    "scripts/wildlife/register-finishing.mjs",
  ]);
  receipts.push([
    `${source}/receipt.json`,
    {
      identity,
      status: "finished",
      reviewStatus: "pending",
      authorization: contracts.authorization,
      policy: contracts.policy,
      method: contract.policy,
      replay,
      artifacts: Object.fromEntries([...artifacts].sort().map((path) => [path, hash(path)])),
    },
  ]);
}
assert.equal(
  rows.length,
  contracts.animals.filter((entry) => entry.policy !== "retained-bank").length,
);
const prefix = original.trimEnd();
assert(prefix.endsWith("\n]"));
const updated = `${prefix.slice(0, -2)},\n${rows
  .map((row) =>
    JSON.stringify(row, null, 2)
      .split("\n")
      .map((line) => `  ${line}`)
      .join("\n"),
  )
  .join(",\n")}\n]\n`;
assert.deepEqual(JSON.parse(updated).slice(0, existing.length), existing);
for (const [path, receipt] of receipts)
  writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`);
writeFileSync("src/wildlife/reviews.json", updated);
writeFileSync("public/demos/wildlife-v2/reviews.json", updated);
const ignore = "public/demos/wildlife-v2/.gitignore";
writeFileSync(
  ignore,
  `${readFileSync(ignore, "utf8").trimEnd()}\n\n# Owner-authorized shared wildlife finishing, tactical 187.\n${rows.map((row) => `!${row.animalId}/${row.revision}/*`).join("\n")}\n`,
);
console.log(
  JSON.stringify({
    registered: rows.length,
    reviewStatus: "pending",
    priorObjectsUnchanged: existing.length,
  }),
);

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PNG } from "pngjs";

const read = (p) => JSON.parse(readFileSync(p, "utf8")),
  hash = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const identities = ["chicken", "bee", "ruby-throated-hummingbird", "foraging-resources"];
const rows = read("src/wildlife/reviews.json"),
  publicRows = read("public/demos/wildlife-v2/reviews.json");
assert.deepEqual(rows, publicRows);
let pins = 0,
  replayed = 0,
  crops = 0,
  endpoints = 0,
  wings = 0,
  contacts = 0;
for (const animal of identities) {
  const revision = animal === "foraging-resources" ? "behavior-v5" : "behavior-v1",
    source = `art-source/wildlife-v2/${animal}/${revision}`,
    base = `public/demos/wildlife-v2/${animal}/${revision}`;
  const receipt = read(`${source}/receipt.json`),
    replay = read(`${source}/replay.json`);
  assert.equal(receipt.reviewStatus, "pending");
  assert.equal(replay.status, "byte-identical");
  replayed += replay.artifacts;
  for (const [path, digest] of Object.entries(receipt.artifacts)) {
    assert.equal(hash(path), digest, path);
    pins++;
  }
  const row = rows.find((r) => r.id === `${animal}-${revision}`);
  assert(row);
  assert.equal(hash(`${base}/sheet.png`), row.sheet.fingerprint);
  assert(read(`${base}/pixel-audit.json`).binaryAlpha);
  {
    const inputs = read(`${source}/inputs.json`),
      old = PNG.sync.read(readFileSync(inputs.sheet)),
      now = PNG.sync.read(readFileSync(`${base}/sheet.png`));
    for (let y = 0; y < old.height; y++)
      assert.deepEqual(
        now.data.subarray(y * now.width * 4, y * now.width * 4 + old.width * 4),
        old.data.subarray(y * old.width * 4, (y + 1) * old.width * 4),
      );
  }
  if (animal !== "foraging-resources") {
    crops += read(`${base}/validation.json`).results.reduce((n, r) => n + r.exactFacingCrops, 0);
    const audit = read(`${base}/source-audit.json`);
    assert(audit.savedSourceIndependentlyChecked);
    endpoints += audit.fixedLengthEndpointChecks;
    wings += audit.wingRootChecks;
    contacts += read(`${base}/pixel-audit.json`).connectedHeadBodyChecks;
  }
}
console.log(
  JSON.stringify({
    pendingIdentities: identities.length,
    pinnedArtifacts: pins,
    isolatedReplayArtifacts: replayed,
    exactNativeAnd3xCrops: crops,
    fixedLengthEndpointChecks: endpoints,
    wingRootChecks: wings,
    connectedHeadBodyChecks: contacts,
    priorTravelCellsUnchanged: true,
  }),
);

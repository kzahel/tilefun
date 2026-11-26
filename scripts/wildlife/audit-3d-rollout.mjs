import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { ENTITY_PALETTE } from "../../src/editor/EditorPalettes.ts";
import { ENTITY_DEFS } from "../../src/entities/EntityDefs.ts";
import {
  WILDLIFE_DEFAULT_MODELS,
  WILDLIFE_MODEL_REVIEW_PREFIX,
  WILDLIFE_MODEL_REVIEWS,
  wildlifeModelReviewPath,
} from "../../src/wildlife/WildlifeModelReviewBank.ts";
import { ANIMAL_BROWSER_ENTRIES } from "../../src/workshop/AnimalBrowserData.ts";

const ledger = JSON.parse(
  await readFile("docs/tactical/256-wildlife-3d-game-rollout/animation-ledger.json", "utf8"),
);
const byType = new Map(ledger.animals.map((row) => [row.type, row]));
const animalBrowser = new Set(ANIMAL_BROWSER_ENTRIES.map(({ type }) => type));
const placeable = new Set(ENTITY_PALETTE.map(({ type }) => type));
assert.equal(byType.size, ledger.animals.length, "Duplicate animals in the ledger");
assert.equal(animalBrowser.size, ledger.baseline.animalBrowser);
assert.equal(byType.size - animalBrowser.size, ledger.baseline.classic);
assert(
  [...animalBrowser].every((type) => byType.has(type)),
  "Animal Browser roster changed",
);
let states = 0;
let qualified = 0;
let observed = 0;
let observedAll = 0;
let live = 0;
const servedReports = new Map();
const defaultByType = new Map(WILDLIFE_DEFAULT_MODELS.map((model) => [model.type, model]));
const drafts = process.argv.includes("--drafts");
for (const row of ledger.animals) {
  const sprite = ENTITY_DEFS[row.type]?.sprite;
  assert(sprite && placeable.has(row.type), `Missing placement or sprite contract: ${row.type}`);
  const expected = Object.keys(row.previewClipsByState);
  assert.deepEqual(
    sprite.clips?.map(({ name }) => name) ?? ["idle", expected[1]],
    expected,
    `Gameplay state list changed: ${row.type}`,
  );
  if (drafts) {
    assert((await stat(row.draft.source)).isFile(), row.draft.source);
    const names = await modelActions(row.draft.model, row.draft.sha256);
    assert(
      Object.values(row.previewClipsByState).every((name) => names.has(name)),
      row.draft.model,
    );
  }
  states += expected.length;
  qualified += Object.keys(row.qualifiedClips).length;
  const servedPath = row.candidatePreview?.servedEvidence;
  const seen = new Set();
  if (servedPath) {
    if (!servedReports.has(servedPath))
      servedReports.set(servedPath, JSON.parse(await readFile(servedPath, "utf8")).results);
    const served = servedReports.get(servedPath).find(({ type }) => row.type === type);
    assert.equal(served?.manifestFingerprint, row.candidatePreview.fingerprint, row.type);
    for (const state of served.statesObserved) seen.add(state);
  }
  if (row.live) {
    const model = defaultByType.get(row.type);
    assert(model && row.live.revision && row.live.url && row.live.evidence, row.type);
    assert.equal(row.live.candidate, WILDLIFE_MODEL_REVIEW_PREFIX + model.id, row.type);
    assert.equal(row.live.sha256, model.files["model.glb"], row.type);
    assert.deepEqual([...row.live.states].sort(), [...expected].sort(), row.type);
    for (const state of row.live.states) seen.add(state);
    live++;
  }
  const count = expected.filter((state) => seen.has(state)).length;
  observed += count;
  if (count === expected.length) observedAll++;
}
assert.equal(
  states,
  ledger.baseline.requiredClips,
  "Reconcile the current state count in Tactical 256",
);

for (const review of WILDLIFE_MODEL_REVIEWS) {
  const row = byType.get(review.type);
  assert(row, review.type);
  const path = `public/${wildlifeModelReviewPath(review.id, "model.glb")}`;
  const hash = review.files["model.glb"];
  const names = await modelActions(path, hash);
  const expected = Object.keys(row.previewClipsByState);
  const bindings = expected.map((name) => review.actions?.[name] ?? name);
  assert.equal(new Set(bindings).size, expected.length, `Aliased gameplay state: ${review.id}`);
  assert(
    bindings.every((name) => names.has(name)),
    `Missing exported action: ${review.id}`,
  );
}
console.log(`${byType.size} runtime animals and ${states} required states`);
console.log(
  `${WILDLIFE_MODEL_REVIEWS.length} registered model candidates, ${qualified} qualified state bindings`,
);
console.log(
  `${WILDLIFE_DEFAULT_MODELS.length} default models, ${live} animals verified as live defaults`,
);
console.log(
  `${observed} states observed under public gameplay authority, with every state observed for ${observedAll} animals`,
);

async function modelActions(path, expectedHash) {
  const raw = await readFile(path);
  const hash = createHash("sha256").update(raw).digest("hex");
  assert.equal(hash, expectedHash, path);
  assert.equal(raw.toString("ascii", 0, 4), "glTF", path);
  assert.equal(raw.readUInt32LE(4), 2, path);
  assert.equal(raw.readUInt32LE(8), raw.length, path);
  const jsonBytes = raw.readUInt32LE(12);
  const gltf = JSON.parse(raw.toString("utf8", 20, 20 + jsonBytes));
  return new Set(gltf.animations?.map(({ name }) => name));
}

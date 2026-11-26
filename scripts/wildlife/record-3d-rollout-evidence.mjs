import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  isGroundHunterModelReviewCase,
  isRaptorModelReviewCase,
  isWildlifeWorkModelReviewCase,
} from "../../src/scenarios/WildlifeBehaviorModelReview.ts";
import {
  isFourStateFaunaModelReview,
  isPackMountModelReview,
  wildlifeFeedingReview,
} from "../../src/scenarios/WildlifeModelReviewRecipe.ts";
import {
  WILDLIFE_MODEL_REVIEW_PREFIX,
  WILDLIFE_MODEL_REVIEWS,
  wildlifeModelReviewPath,
} from "../../src/wildlife/WildlifeModelReviewBank.ts";

const [batch, runtimePath, deployedPath] = process.argv.slice(2);
assert(
  /^wildlife-3d-[a-z0-9-]+$/.test(batch ?? "") && runtimePath && deployedPath,
  "Usage: record-3d-rollout-evidence.mjs WORKSHOP_BATCH RUNTIME_REPORT DEPLOYMENT_REPORT",
);
const read = async (path) => JSON.parse(await readFile(path, "utf8"));
const directory = "docs/tactical/256-wildlife-3d-game-rollout";
const ledgerPath = join(directory, "animation-ledger.json");
const evidence = join(directory, "evidence");
const name = batch.slice("wildlife-3d-".length);
const runtimeEvidence = join(evidence, `${name}-runtime.json`);
const deployedEvidence = join(evidence, `${name}-deployment.json`);
const [ledger, runtime, deployed, manifest] = await Promise.all([
  read(ledgerPath),
  read(runtimePath),
  read(deployedPath),
  read("public/data/workshop-manifest.json"),
]);
const models = WILDLIFE_MODEL_REVIEWS.filter((item) => item.batch === batch);
assert(models.length, `No registered models in ${batch}`);
assert.equal(models.length, runtime.candidates.length);
assert.equal(models.length, deployed.results.length);
assert(deployed.deployment && deployed.workshopInputDigest, "Missing served revision");
for (const model of models) {
  const id = WILDLIFE_MODEL_REVIEW_PREFIX + model.id;
  const hash = model.files["model.glb"];
  const record = ledger.animals.find(({ type }) => model.type === type);
  const samples = runtime.candidates.find(({ candidateId }) => model.id === candidateId);
  const served = deployed.results.find(({ type }) => model.type === type);
  const registered = manifest.candidates.find((candidate) => candidate.id === id);
  assert(record && samples && served && registered, `Incomplete evidence for ${id}`);
  assert.equal(samples.modelSha256, hash);
  assert.equal(served.modelSha256, hash);
  assert.equal(served.manifestFingerprint, registered.fingerprint);
  assert(
    served.spritePreferenceRoundTrip &&
      served.game?.createdAndDrawn &&
      served.game?.savedAndDrawnAfterReload,
    id,
  );
  const required = Object.keys(record.previewClipsByState);
  assert.deepEqual(samples.measuredClips.map((sample) => sample.state).sort(), required.sort(), id);
  if (
    model.classicTravel ||
    isWildlifeWorkModelReviewCase(model.lab) ||
    isGroundHunterModelReviewCase(model.lab) ||
    isRaptorModelReviewCase(model.lab) ||
    wildlifeFeedingReview(model.type, model.lab) ||
    isPackMountModelReview(model.type, model.lab) ||
    isFourStateFaunaModelReview(model.type, model.lab)
  )
    assert.deepEqual(
      [...(served.game.statesAfterReload ?? [])].sort(),
      required,
      `Missing gameplay states after reopening the world for ${id}`,
    );
  for (const { state, action, frames, gameDurationMs } of samples.measuredClips) {
    const image = state === "idle" ? "native.png" : `${state}.png`;
    assert(model.files[image] && frames > 0 && gameDurationMs > 0, `${id} ${state}`);
    assert.equal(action, model.actions?.[state] ?? state);
    record.qualifiedClips[state] = {
      action,
      sha256: hash,
      evidence: runtimeEvidence,
      comparison: `public/${wildlifeModelReviewPath(model.id, image)}`,
    };
  }
  record.candidatePreview = {
    candidate: id,
    fingerprint: registered.fingerprint,
    model: `public/${wildlifeModelReviewPath(model.id, "model.glb")}`,
    source: `public/${wildlifeModelReviewPath(model.id, "model.blend")}`,
    comparison: `public/${wildlifeModelReviewPath(model.id, "comparison.mp4")}`,
    review: "pending",
    servedEvidence: deployedEvidence,
  };
}

await mkdir(evidence, { recursive: true });
await copyFile(runtimePath, runtimeEvidence);
await copyFile(deployedPath, deployedEvidence);
await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
console.log(
  `Recorded exact state and deployment-preview evidence for ${models.length} animals in ${batch}.`,
);

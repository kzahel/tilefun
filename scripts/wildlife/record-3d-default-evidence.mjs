import assert from "node:assert/strict";
import { constants } from "node:fs";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import {
  WILDLIFE_DEFAULT_MODELS,
  WILDLIFE_MODEL_REVIEW_PREFIX,
} from "../../src/wildlife/WildlifeModelReviewBank.ts";

const [reportPath, name] = process.argv.slice(2);
assert(
  reportPath && /^[a-z0-9-]+$/.test(name ?? ""),
  "Usage: record-3d-default-evidence.mjs REPORT REPORT_NAME",
);
const directory = "docs/tactical/256-wildlife-3d-game-rollout";
const ledgerPath = `${directory}/animation-ledger.json`;
const evidence = `${directory}/evidence/${name}-default.json`;
const read = async (path) => JSON.parse(await readFile(path, "utf8"));
const [ledger, report] = await Promise.all([read(ledgerPath), read(reportPath)]);
assert(
  /^[\da-f]{40}$/.test(report.revision) && report.workshopInputDigest,
  "Missing deployed revision",
);
assert.equal(new URL(report.deployment).protocol, "https:", "Deployed game evidence is required");
assert(report.results.length, "Empty default game report");
for (const result of report.results) {
  const row = ledger.animals.find(({ type }) => type === result.type);
  const model = WILDLIFE_DEFAULT_MODELS.find(({ type }) => type === result.type);
  assert(row && model && result.mode === "default", `Missing default model: ${result.type}`);
  const candidate = WILDLIFE_MODEL_REVIEW_PREFIX + model.id;
  assert.equal(row.candidatePreview?.candidate, candidate);
  assert.equal(row.candidatePreview.fingerprint, result.manifestFingerprint);
  const modelSha256 = model.files["model.glb"];
  assert.equal(result.modelSha256, modelSha256);
  assert(result.spritePreferenceRoundTrip, `${result.type}: missing sprite preference check`);
  assert(result.game.createdAndDrawn && result.game.savedAndDrawnAfterReload);
  const required = Object.keys(row.previewClipsByState).sort();
  assert.deepEqual([...result.statesObserved].sort(), required);
  assert.deepEqual([...(result.game.statesAfterReload ?? [])].sort(), required);
  assert(required.every((state) => row.qualifiedClips[state]?.sha256 === modelSha256));
  row.live = {
    revision: report.revision,
    url: report.deployment,
    candidate,
    sha256: modelSha256,
    states: required,
    evidence,
  };
}
await copyFile(reportPath, evidence, constants.COPYFILE_EXCL);
await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
console.log(`Recorded deployed default evidence for ${report.results.length} animal models.`);

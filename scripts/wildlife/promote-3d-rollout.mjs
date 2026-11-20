import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { verifyWildlifeEvidence } from "../../src/server/wildlifeEvidence.ts";
import { WorkshopService } from "../../src/server/workshopService.ts";
import {
  WILDLIFE_MODEL_REVIEW_PREFIX,
  WILDLIFE_MODEL_REVIEWS,
  wildlifeModelReviewPath,
  wildlifeModelRuntimePath,
} from "../../src/wildlife/WildlifeModelReviewBank.ts";

const [batch] = process.argv.slice(2);
assert(batch, "Usage: promote-3d-rollout.mjs WORKSHOP_BATCH");
const models = WILDLIFE_MODEL_REVIEWS.filter((candidate) => candidate.batch === batch);
assert(models.length, `Unknown 3D wildlife batch: ${batch}`);
const inbox = await new WorkshopService().inbox();
assert(inbox.manifestCurrent, "Regenerate the Workshop manifest before promoting");
const ledgerPath = "docs/tactical/256-wildlife-3d-game-rollout/animation-ledger.json";
const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
const runtimeRegistryPath = "src/wildlife/promoted-models.json";
const runtimeRegistry = JSON.parse(await readFile(runtimeRegistryPath, "utf8"));
const decisions = [];
for (const model of models) {
  const id = WILDLIFE_MODEL_REVIEW_PREFIX + model.id;
  const decision = inbox.candidates.find((candidate) => candidate.id === id);
  assert(decision?.state === "approved" && decision.lastDecision, `Owner approval needed: ${id}`);
  await verifyWildlifeEvidence(id, ".", decision.review?.revision);
  const row = ledger.animals.find((animal) => animal.type === model.type);
  assert(row, `Missing rollout ledger row: ${model.type}`);
  const hash = model.files["model.glb"];
  assert(
    Object.keys(row.previewClipsByState).every(
      (state) => row.qualifiedClips[state]?.sha256 === hash,
    ),
    `Qualify each state on this exact GLB before promotion: ${model.type}`,
  );
  decisions.push({ model, decision, id, row, hash });
}

for (const { model, decision, id, row, hash } of decisions) {
  const runtimePath = join("public", wildlifeModelRuntimePath(model.id));
  await mkdir(dirname(runtimePath), { recursive: true });
  await copyFile(join("public", wildlifeModelReviewPath(model.id, "model.glb")), runtimePath);
  runtimeRegistry[model.type] = model.id;
  row.promotion = {
    candidate: id,
    fingerprint: decision.fingerprint,
    sha256: hash,
    disposition: "approved",
    reviewedAt: decision.lastDecision,
  };
}
await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
await writeFile(runtimeRegistryPath, `${JSON.stringify(runtimeRegistry, null, 2)}\n`);
console.log(`Promoted ${decisions.length} exact owner-approved wildlife models from ${batch}.`);

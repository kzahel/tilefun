import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { verifyWildlifeEvidence } from "../../src/server/wildlifeEvidence.ts";
import { WorkshopService } from "../../src/server/workshopService.ts";
import {
  WILDLIFE_MODEL_REVIEW_PREFIX,
  WILDLIFE_MODEL_REVIEWS,
} from "../../src/wildlife/WildlifeModelReviewBank.ts";

const ids = process.argv.slice(2);
assert(ids.length, "Usage: promote-3d-rollout.mjs CANDIDATE_ID [...]");
const ledgerPath = "docs/tactical/256-wildlife-3d-game-rollout/animation-ledger.json";
const defaultsPath = "src/wildlife/default-models.json";
const [inbox, ledger, defaults] = await Promise.all([
  new WorkshopService().inbox(),
  readFile(ledgerPath, "utf8").then(JSON.parse),
  readFile(defaultsPath, "utf8").then(JSON.parse),
]);
assert(inbox.manifestCurrent, "Regenerate the Workshop manifest before promoting");
const selectedTypes = new Set();
for (const id of ids) {
  const model = WILDLIFE_MODEL_REVIEWS.find((row) => row.id === id);
  assert(model && !selectedTypes.has(model.type), `Unknown or duplicate rollout model: ${id}`);
  selectedTypes.add(model.type);
  const candidate = WILDLIFE_MODEL_REVIEW_PREFIX + id;
  const decision = inbox.candidates.find((row) => row.id === candidate);
  assert(
    decision?.state === "approved" && decision.lastDecision,
    `Workshop approval needed: ${id}`,
  );
  await verifyWildlifeEvidence(candidate, ".", decision.review?.revision);

  const row = ledger.animals.find(({ type }) => type === model.type);
  const sha256 = model.files["model.glb"];
  assert(
    row?.candidatePreview?.candidate === candidate &&
      row.candidatePreview.fingerprint === decision.fingerprint &&
      Object.keys(row.previewClipsByState).every(
        (state) => row.qualifiedClips[state]?.sha256 === sha256,
      ),
    `Record exact gameplay and animation evidence before promotion: ${id}`,
  );
  if (defaults[model.type] !== id) row.live = null;
  defaults[model.type] = id;
  row.promotion = {
    candidate,
    fingerprint: decision.fingerprint,
    sha256,
    disposition: "approved",
    reviewedAt: decision.lastDecision,
  };
}

const orderedDefaults = Object.fromEntries(
  Object.entries(defaults).sort(([a], [b]) => a.localeCompare(b)),
);
await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
await writeFile(defaultsPath, `${JSON.stringify(orderedDefaults, null, 2)}\n`);
console.log(`Promoted ${ids.length} exact Workshop-approved wildlife models.`);

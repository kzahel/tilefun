import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, safeArtifact } from "./campaign.mjs";

export function petReceiptErrors(pet, revision, root = ROOT) {
  const errors = [];
  const base = `art-source/wildlife-v2/${pet.id}/${revision}`;
  try {
    const receipt = JSON.parse(readFileSync(safeArtifact(root, `${base}/receipt.json`), "utf8"));
    if (
      receipt.identity !== `${pet.id}-${revision}` ||
      receipt.status !== "draft-ready" ||
      receipt.reviewStatus !== "pending"
    )
      errors.push("Invalid pending draft identity");
    if (
      receipt.motionContract !== "body-motion-20261004" ||
      receipt.visualReview?.observer !== "coordinator"
    )
      errors.push("Missing motion contract/coordinator observations");
    for (const check of [
      "projection",
      "anatomy",
      "headVolume",
      "contacts",
      "continuousPlayback",
      "sceneScale",
      "weightTransfer",
    ])
      if ((receipt.visualReview?.checks?.[check] ?? "").trim().length < 24)
        errors.push(`Missing concrete observation: ${check}`);
    const artifacts = Object.entries(receipt.artifacts ?? {});
    for (const suffix of [
      "animal.blend",
      "masters.json",
      "sheet.png",
      "sprite.json",
      "preview.gif",
      "scene-native.png",
      "source-audit.json",
      "playback.js",
      "index.html",
    ])
      if (!artifacts.some(([path]) => path.endsWith(suffix))) errors.push(`Missing ${suffix}`);
    for (const [path, expected] of artifacts) {
      const actual = createHash("sha256")
        .update(readFileSync(safeArtifact(root, path)))
        .digest("hex");
      if (actual !== expected) errors.push(`Changed artifact: ${path}`);
    }
  } catch (error) {
    errors.push(error.message);
  }
  return errors;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const batch = JSON.parse(
    readFileSync(resolve(ROOT, "art-source/wildlife-v2/pet-batch.json"), "utf8"),
  );
  const errors = batch.pets.flatMap((pet) =>
    petReceiptErrors(pet, batch.revision).map((e) => `${pet.id}: ${e}`),
  );
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(`Verified ${batch.pets.length} exact pending pet drafts`);
}

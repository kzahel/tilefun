import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, safeArtifact } from "./campaign.mjs";

export function predatorReceiptErrors(species, root = ROOT) {
  const errors = [];
  try {
    if (!["panther", "lion", "brown-bear"].includes(species)) throw Error("Unauthorized species");
    const receipt = JSON.parse(
      readFileSync(resolve(root, `art-source/wildlife-v2/${species}/hunt-v1/receipt.json`), "utf8"),
    );
    if (
      receipt.identity !== `${species}-hunt-v1` ||
      receipt.status !== "draft-ready" ||
      receipt.reviewStatus !== "pending" ||
      receipt.motionContract !== "body-motion-20261004" ||
      receipt.visualReview?.observer !== "coordinator" ||
      receipt.sourceAudit?.poses !== 116 ||
      receipt.replay?.status !== "byte-identical"
    )
      errors.push("Invalid pending predator receipt");
    for (const suffix of [
      "animal.blend",
      "masters.json",
      "build.py",
      "finish.py",
      "audit.py",
      "capture.mjs",
      "sheet.png",
      "sprite.json",
      "preview.gif",
      "source-audit.json",
      "review-observations.md",
    ]) {
      if (!Object.keys(receipt.artifacts).some((p) => p.endsWith(suffix)))
        errors.push(`Missing ${suffix}`);
    }
    const external = new Set([
      "scripts/wildlife/register-predator.mjs",
      "public/assets/tilesets/me-complete.png",
      "public/demos/pixel-characters/person-32.png",
    ]);
    for (const [path, expected] of Object.entries(receipt.artifacts)) {
      const absolute = external.has(path) ? resolve(root, path) : safeArtifact(root, path);
      const actual = createHash("sha256").update(readFileSync(absolute)).digest("hex");
      if (actual !== expected) errors.push(`Changed artifact: ${path}`);
    }
  } catch (error) {
    errors.push(String(error));
  }
  return errors;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let failed = false;
  for (const species of ["panther", "lion", "brown-bear"]) {
    if (!existsSync(resolve(ROOT, `art-source/wildlife-v2/${species}/hunt-v1/receipt.json`)))
      continue;
    const errors = predatorReceiptErrors(species);
    console.log(JSON.stringify({ species, errors }));
    failed ||= errors.length > 0;
  }
  if (failed) process.exitCode = 1;
}

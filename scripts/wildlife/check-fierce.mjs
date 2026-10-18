import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, safeArtifact } from "./campaign.mjs";

export function fierceReceiptErrors(species, root = ROOT) {
  const errors = [];
  try {
    if (!["t-rex", "small-dragon", "dire-wolf", "griffin", "giant-spider"].includes(species))
      throw Error("Unauthorized species");
    const receipt = JSON.parse(
      readFileSync(
        resolve(root, `art-source/wildlife-v2/${species}/fierce-v1/receipt.json`),
        "utf8",
      ),
    );
    if (
      receipt.identity !== `${species}-fierce-v1` ||
      receipt.status !== "draft-ready" ||
      receipt.reviewStatus !== "pending" ||
      receipt.motionContract !== "body-motion-20261004" ||
      receipt.visualReview?.observer !== "primary-agent" ||
      receipt.sourceAudit?.poses < 164 ||
      receipt.replay?.status !== "byte-identical"
    )
      errors.push("Invalid pending fierce-creature receipt");
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
    ])
      if (!Object.keys(receipt.artifacts).some((p) => p.endsWith(suffix)))
        errors.push(`Missing ${suffix}`);
    for (const [path, expected] of Object.entries(receipt.artifacts)) {
      const absolute = [
        "scripts/wildlife/register-fierce.mjs",
        "public/assets/tilesets/me-complete.png",
        "public/demos/pixel-characters/person-32.png",
      ].includes(path)
        ? resolve(root, path)
        : safeArtifact(root, path);
      if (createHash("sha256").update(readFileSync(absolute)).digest("hex") !== expected)
        errors.push(`Changed artifact: ${path}`);
    }
  } catch (error) {
    errors.push(String(error));
  }
  return errors;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const species of ["t-rex", "small-dragon", "dire-wolf", "griffin", "giant-spider"]) {
    if (!existsSync(resolve(ROOT, `art-source/wildlife-v2/${species}/fierce-v1/receipt.json`)))
      continue;
    const errors = fierceReceiptErrors(species);
    console.log(JSON.stringify({ species, errors }));
    if (errors.length) process.exitCode = 1;
  }
}

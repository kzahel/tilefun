import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, safeArtifact } from "./campaign.mjs";

// The tiger scale study also reads two existing art banks. The historical
// campaign's stricter wildlife-only namespace policy stays unchanged.
const dependencies = new Set([
  "public/assets/tilesets/me-complete.png",
  "public/demos/pixel-characters/person-32.png",
]);

export function tigerReceiptErrors(root = ROOT) {
  const errors = [];
  try {
    const receipt = JSON.parse(
      readFileSync(resolve(root, "art-source/wildlife-v2/tiger/pilot-v1/receipt.json"), "utf8"),
    );
    if (
      receipt.identity !== "tiger-pilot-v1" ||
      receipt.status !== "draft-ready" ||
      receipt.reviewStatus !== "pending" ||
      receipt.motionContract !== "body-motion-20261004" ||
      receipt.visualReview?.observer !== "coordinator"
    )
      errors.push("Invalid pending tiger receipt or motion review");
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
        errors.push(`Missing observation: ${check}`);
    const artifacts = Object.entries(receipt.artifacts ?? {});
    for (const suffix of [
      "animal.blend",
      "masters.json",
      "build.py",
      "finish.py",
      "audit.py",
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
      const absolute = dependencies.has(path) ? resolve(root, path) : safeArtifact(root, path);
      const actual = createHash("sha256").update(readFileSync(absolute)).digest("hex");
      if (actual !== expected) errors.push(`Changed artifact: ${path}`);
    }
    if (receipt.sourceAudit?.poses !== 116 || receipt.replay?.status !== "byte-identical")
      errors.push("Missing saved-source audit or exact replay");
    if (
      receipt.browser?.results?.length !== 2 ||
      receipt.browser.results.some((row) => row.errors.length || row.chronologicalPoses !== 29)
    )
      errors.push("Incomplete native/enlarged browser playback");
  } catch (error) {
    errors.push(error.message);
  }
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = tigerReceiptErrors();
  if (errors.length) throw new Error(errors.join("\n"));
  console.log("Verified exact pending tiger source, pixels, replay and browser evidence");
}

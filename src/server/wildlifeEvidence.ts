import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import {
  WILDLIFE_MODEL_REVIEW_PREFIX,
  type WildlifeModelReview,
  wildlifeModelReviewPath,
} from "../wildlife/WildlifeModelReviewBank.js";
import { HttpError } from "./workshopAuth.js";

/** Archive caches are not build inputs, but remain mandatory review evidence.
 * Check at submission time too: manifest freshness cannot certify these files.
 */
export async function verifyWildlifeEvidence(candidateId: string, root = ".", revision?: string) {
  const files = candidateId.startsWith(WILDLIFE_MODEL_REVIEW_PREFIX)
    ? await modelReviewFiles(candidateId, root, revision)
    : await spriteReviewFiles(candidateId, root);
  if (!files?.length) throw new HttpError(409, "Unknown wildlife evidence");
  const publicRoot = resolve(root, "public");
  for (const file of files) {
    const path = resolve(publicRoot, file.path);
    if (!path.startsWith(publicRoot + sep)) throw new HttpError(409, "Invalid wildlife evidence");
    let matches = false;
    try {
      matches =
        createHash("sha256")
          .update(await readFile(path))
          .digest("hex") === file.sha256;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (!matches) throw new HttpError(409, `Wildlife artifact changed: ${file.path}`);
  }
}

async function spriteReviewFiles(candidateId: string, root: string) {
  const registry = JSON.parse(
    await readFile(resolve(root, "src/wildlife/reviews.json"), "utf8"),
  ) as { id: string; files: { path: string; sha256: string }[] }[];
  return registry.find((row) => `pattern:wildlife-v2-${row.id}` === candidateId)?.files;
}

async function modelReviewFiles(candidateId: string, root: string, revision?: string) {
  const registry = JSON.parse(
    await readFile(resolve(root, "src/wildlife/model-reviews.json"), "utf8"),
  ) as WildlifeModelReview[];
  const model = registry.find(({ id }) => WILDLIFE_MODEL_REVIEW_PREFIX + id === candidateId);
  if (!model || createHash("sha256").update(JSON.stringify(model)).digest("hex") !== revision)
    throw new HttpError(409, "Wildlife model revision changed");
  return Object.entries(model.files).map(([name, sha256]) => ({
    path: wildlifeModelReviewPath(model.id, name),
    sha256,
  }));
}

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { HttpError } from "./workshopAuth.js";

/** Archive caches are not build inputs, but remain mandatory review evidence.
 * Check at submission time too: manifest freshness cannot certify these files.
 */
export async function verifyWildlifeEvidence(candidateId: string, root = ".") {
  const registry = JSON.parse(
    await readFile(resolve(root, "src/wildlife/reviews.json"), "utf8"),
  ) as { id: string; files: { path: string; sha256: string }[] }[];
  const draft = registry.find((row) => `pattern:wildlife-v2-${row.id}` === candidateId);
  if (!draft || draft.files.length === 0) throw new HttpError(409, "Unknown wildlife evidence");
  const publicRoot = resolve(root, "public");
  for (const file of draft.files) {
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

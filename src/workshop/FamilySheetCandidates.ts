import { sha256 } from "../art/ArtSource.js";
import { familyCanonicalJSON, loadFamilySheetCatalog } from "./FamilySheetArt.js";
import type { WorkshopCandidate } from "./WorkshopTypes.js";

/** Discovery identities for proposed metadata. Notes use the existing source
 * inbox; these entries deliberately carry no art/geometry approval payload. */
export async function buildFamilySheetCandidates(): Promise<WorkshopCandidate[]> {
  const catalog = await loadFamilySheetCatalog();
  return Promise.all(
    catalog.families.map(async (family) => ({
      id: `family:${family.id}`,
      batchId: "asset-families",
      kind: "family" as const,
      name: family.name,
      prompt:
        "Look through the pieces and leave a note about their names or how they fit together.",
      url: `/tilefun/workshop.html#/tool/families?family=${family.id}&revision=${family.revision}`,
      fingerprint: await sha256(
        new TextEncoder().encode(
          familyCanonicalJSON({
            family,
            sources: catalog.sources.map(({ id, fingerprint }) => ({ id, fingerprint })),
          }),
        ),
      ),
    })),
  );
}

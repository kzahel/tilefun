import type { ArtNote } from "../art/ArtNotes.js";
import {
  FAMILY_SHEET_IDS,
  type FamilyMember,
  type FamilySheet,
  type FamilySheetCatalog,
  familyVariant,
} from "./FamilySheetTypes.js";
import type { WorkshopEvent } from "./WorkshopTypes.js";

export function familyNoteTarget(keys: string[]) {
  const get = (prefix: string) => keys.find((key) => key.startsWith(prefix))?.slice(prefix.length);
  const family = get("family-sheet:");
  const revision = get("family-proposal:");
  if (
    !family ||
    !FAMILY_SHEET_IDS.some((id) => id === family) ||
    !/^[a-f0-9]{64}$/.test(revision ?? "")
  )
    return null;
  return {
    family,
    revision: revision as string,
    member: get("family-member:"),
    variant: get("family-variant:"),
  };
}

export function familyNoteUrl(note: Pick<ArtNote, "sliceKeys">) {
  const target = familyNoteTarget(note.sliceKeys);
  if (!target) return undefined;
  const params = new URLSearchParams({ family: target.family, revision: target.revision });
  if (target.member) params.set("member", target.member);
  if (target.variant) params.set("variant", target.variant);
  return `/tilefun/workshop.html#/tool/families?${params}`;
}

/** Existing source-note storage carries exact family/member revisions without
 * treating a discussion as approval. The source rect is the preview's anchor;
 * all composition layers are retained in sliceKeys and in the pinned catalog.
 */
export function familyNoteEvent(
  catalog: FamilySheetCatalog,
  family: FamilySheet,
  member: FamilyMember | null,
  variantId: string,
  note: string,
  id: string,
): Extract<WorkshopEvent, { type: "source" }> {
  const anchor = member ?? family.groups.flatMap((g) => g.members)[0];
  if (!anchor || !note.trim() || note.length > 2000)
    throw new Error("Write a note of up to 2,000 characters.");
  const variant = familyVariant(anchor, variantId);
  const first = variant.sprite.layers[0];
  const sheet = catalog.sources.find((s) => s.id === first?.sheetId);
  if (!first || !sheet) throw new Error("This piece has no source reference.");
  const label = member
    ? `${family.name} · ${member.number}. ${member.label} · ${variant.label}`
    : `${family.name} · Whole family`;
  return {
    id,
    type: "source",
    sheetId: sheet.id,
    fingerprint: sheet.fingerprint,
    rect: first.rect,
    intent: "other",
    sliceKeys: [
      `family-sheet:${family.id}`,
      `family-proposal:${family.revision}`,
      `family-catalog:${catalog.revision}`,
      `family-variant:${variantId}`,
      ...(member ? [`family-member:${member.id}`] : []),
      ...variant.sprite.layers.map((layer) => {
        const source = catalog.sources.find((s) => s.id === layer.sheetId);
        if (!source) throw new Error("Missing composition source.");
        return `family-layer:${source.id}:${source.fingerprint}:${layer.rect.join(",")}:${layer.at.join(",")}`;
      }),
    ],
    note: `${label}\n\n${note.trim()}`,
  };
}

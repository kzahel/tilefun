import type { ArtNote, BuildingReview, BuildingVerdict } from "./ArtNotes.js";

export function buildingCaseKey(review: Pick<BuildingReview, "scene" | "prefabIds">): string {
  return review.scene === "single"
    ? `single:${review.prefabIds.join(",")}`
    : `block:${review.scene}`;
}

/** Only a human decision on the latest appearance hides a candidate. Replies cannot reorder it. */
export function currentBuildingVerdict(
  notes: readonly ArtNote[],
  sourceFingerprint: string,
  review: BuildingReview,
): BuildingVerdict["value"] | undefined {
  let latest: ArtNote | undefined;
  for (const note of notes) {
    if (
      !note.buildingVerdict ||
      !note.buildingReview ||
      buildingCaseKey(note.buildingReview) !== buildingCaseKey(review)
    )
      continue;
    if (
      !latest ||
      Date.parse(note.buildingVerdict.createdAt) >=
        Date.parse(latest.buildingVerdict?.createdAt ?? "")
    )
      latest = note;
  }
  if (
    !latest?.buildingReview ||
    latest.buildingVerdict?.value === "clear" ||
    latest.fingerprint !== sourceFingerprint ||
    latest.buildingReview.revision !== review.revision ||
    !review.renderFingerprint ||
    latest.buildingReview.renderFingerprint !== review.renderFingerprint
  )
    return undefined;
  return latest.buildingVerdict?.value;
}

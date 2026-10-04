import { type ArtNote, latestArtNotes } from "../art/ArtNotes.js";
import { buildingCaseKey, currentBuildingVerdict } from "../art/BuildingReviewQueue.js";
import type { ReviewFeedback } from "../interiors/review/ReviewFeedback.js";
import { familyNoteUrl } from "./FamilySheetNotes.js";
import type {
  CandidateSummary,
  WorkshopActivity,
  WorkshopCandidate,
  WorkshopThread,
} from "./WorkshopTypes.js";

export function candidateSummary(
  c: WorkshopCandidate,
  art: ArtNote[],
  interiors: ReviewFeedback[],
  current = true,
): CandidateSummary {
  if (c.excluded) return { ...c, state: "excluded" };
  if (!current) return { ...c, state: "unchecked" };
  // Family discussions do not approve metadata, rendered art or geometry.
  if (c.kind === "family") return { ...c, state: "unchecked" };
  if (c.kind === "character") {
    const row = latestArtNotes(art)
      .filter((n) => n.characterAnnotation?.candidateId === c.id)
      .sort((a, b) =>
        (a.characterAnnotation?.createdAt ?? "").localeCompare(
          b.characterAnnotation?.createdAt ?? "",
        ),
      )
      .at(-1);
    const a = row?.characterAnnotation;
    return {
      ...c,
      state: !a
        ? "unchecked"
        : a.candidateFingerprint !== c.fingerprint || row?.fingerprint !== c.sourceFingerprint
          ? "changed"
          : a.verdict === "note"
            ? "unchecked"
            : a.verdict,
      ...(a ? { lastDecision: a.createdAt } : {}),
    };
  }
  if (c.kind === "vehicle") {
    const row = latestArtNotes(art)
      .filter((n) => n.assetAnnotation?.candidateId === c.id)
      .sort((a, b) =>
        (a.assetAnnotation?.createdAt ?? "").localeCompare(b.assetAnnotation?.createdAt ?? ""),
      )
      .at(-1);
    const annotation = row?.assetAnnotation;
    return {
      ...c,
      state: !annotation
        ? "unchecked"
        : annotation.candidateFingerprint !== c.fingerprint ||
            row?.fingerprint !== c.sourceFingerprint
          ? "changed"
          : annotation.verdict === "note"
            ? "unchecked"
            : annotation.verdict,
      ...(annotation ? { lastDecision: annotation.createdAt } : {}),
    };
  }
  if (c.review) {
    const verdict = currentBuildingVerdict(art, c.sourceFingerprint ?? "", c.review);
    const latest = art
      .filter(
        (r) => r.buildingVerdict && r.buildingReview && buildingCaseKey(r.buildingReview) === c.id,
      )
      .sort((a, b) =>
        (a.buildingVerdict?.createdAt ?? "").localeCompare(b.buildingVerdict?.createdAt ?? ""),
      )
      .at(-1);
    return {
      ...c,
      state:
        verdict === "approved"
          ? "approved"
          : verdict === "changes"
            ? "changes"
            : latest?.buildingVerdict?.value !== "clear" && latest
              ? "changed"
              : "unchecked",
      ...(latest?.buildingVerdict ? { lastDecision: latest.buildingVerdict.createdAt } : {}),
    };
  }
  const row = interiors.filter((r) => r.caseId === c.id).at(-1);
  const matches =
    c.kind === "motion"
      ? row?.playtest?.sceneSignature === c.sceneSignature
      : row?.fingerprint === c.fingerprint;
  return {
    ...c,
    state:
      row?.verdict === "clear" || !row
        ? "unchecked"
        : !matches
          ? "changed"
          : row.verdict === "good"
            ? "approved"
            : "changes",
    ...(row ? { lastDecision: row.createdAt } : {}),
  };
}
export function artThread(row: ArtNote): WorkshopThread {
  return {
    id: `art:${row.threadId}`,
    kind: "art",
    name:
      row.characterAnnotation?.candidateId.replace("character:", "") ??
      row.assetAnnotation?.metadata.name ??
      row.sceneAnnotation?.candidateId.replace("district:", "") ??
      row.buildingReview?.caseId ??
      row.buildingReview?.prefabIds.join(", ") ??
      (familyNoteUrl(row) ? row.note.split("\n")[0] : undefined) ??
      row.sheetId,
    note: row.note,
    reply: row.reply,
    status: row.status,
    createdAt: row.createdAt,
    url:
      (row.characterAnnotation
        ? `/tilefun/workshop.html#/tool/character-lab?character=${encodeURIComponent(row.characterAnnotation.candidateId.replace("character:", ""))}`
        : row.sceneAnnotation
          ? `/tilefun/workshop.html#/scene/${encodeURIComponent(row.sceneAnnotation.candidateId.replace("district:", ""))}?note=${row.threadId}`
          : row.assetAnnotation?.candidateId
            ? `/tilefun/workshop.html#/tool/vehicles?view=${encodeURIComponent(row.assetAnnotation.candidateId)}`
            : row.assetAnnotation
              ? `/tilefun/workshop.html#/tool/outdoor?asset=${encodeURIComponent(row.assetAnnotation.assetId)}`
              : undefined) ??
      familyNoteUrl(row) ??
      row.buildingReview?.url ??
      `/tilefun/art-workbench.html?sheet=${encodeURIComponent(row.sheetId)}&rect=${row.rect.join(",")}`,
    ...(row.buildingReview ? { caseId: buildingCaseKey(row.buildingReview) } : {}),
  };
}
export function interiorThread(row: ReviewFeedback): WorkshopThread {
  return {
    id: `interior:${row.caseId}`,
    kind: "interior",
    name: row.name,
    note: row.note,
    reply: "",
    status: row.verdict === "wrong" ? "pending" : "resolved",
    createdAt: row.createdAt,
    url: row.playtest
      ? `/tilefun/furniture-playtest.html?scene=${encodeURIComponent(row.caseId.replace(/^furniture-motion-/, ""))}`
      : `/tilefun/interior-review.html?unchecked=0&case=${encodeURIComponent(row.caseId)}`,
    caseId: row.caseId,
  };
}
export function pendingRequests(art: ArtNote[], interiors: ReviewFeedback[]): WorkshopThread[] {
  const latest = new Map<string, ReviewFeedback>();
  for (const row of interiors) latest.set(row.caseId, row);
  return [
    ...latestArtNotes(art)
      .filter((r) => r.status !== "resolved")
      .map(artThread),
    ...[...latest.values()].filter((r) => r.verdict === "wrong").map(interiorThread),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function projectActivity(art: ArtNote[], interiors: ReviewFeedback[]): WorkshopActivity[] {
  return [
    ...art.map((row) => ({
      ...artThread(row),
      eventId: row.id,
      ...(row.buildingVerdict ? { verdict: row.buildingVerdict.value } : {}),
      ...(row.characterAnnotation ? { verdict: row.characterAnnotation.verdict } : {}),
      ...(row.assetAnnotation ? { verdict: row.assetAnnotation.verdict } : {}),
    })),
    ...interiors.map((row) => ({ ...interiorThread(row), eventId: row.id, verdict: row.verdict })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.eventId.localeCompare(a.eventId));
}

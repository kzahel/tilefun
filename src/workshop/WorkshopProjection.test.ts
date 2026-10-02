import { expect, it } from "vitest";
import type { ArtNote } from "../art/ArtNotes.js";
import { candidateSummary, pendingRequests } from "./WorkshopProjection.js";
import type { WorkshopCandidate } from "./WorkshopTypes.js";

const review = {
  scene: "surface" as const,
  caseId: "surface-v1-narrow",
  surfaceRecipe: "city-surfaces-v1",
  prefabIds: [],
  revision: "a".repeat(64),
  renderFingerprint: "b".repeat(64),
  url: "/tilefun/building-lab.html?run=surfaces&case=surface-v1-narrow",
};
const candidate: WorkshopCandidate = {
  id: "surface:surface-v1-narrow",
  batchId: "roads",
  kind: "art",
  name: "Road",
  prompt: "",
  url: review.url,
  fingerprint: review.renderFingerprint,
  sourceFingerprint: "c".repeat(64),
  review,
};
const note: ArtNote = {
  id: "one",
  threadId: "one",
  sheetId: "me-complete",
  fingerprint: candidate.sourceFingerprint ?? "",
  sheetSize: [2816, 8224],
  rect: [0, 0, 16, 16],
  sliceKeys: [],
  intent: "terrain",
  status: "resolved",
  note: "Approved",
  reply: "",
  createdAt: "2026-10-01T00:00:00Z",
  buildingReview: review,
  buildingVerdict: { value: "approved", createdAt: "2026-10-01T00:00:00Z" },
};
it("distinguishes unseen, changed, cleared and stale-manifest candidates", () => {
  expect(candidateSummary(candidate, [], []).state).toBe("unchecked");
  expect(candidateSummary(candidate, [note], []).state).toBe("approved");
  expect(
    candidateSummary(
      { ...candidate, review: { ...review, renderFingerprint: "d".repeat(64) } },
      [note],
      [],
    ).state,
  ).toBe("changed");
  expect(
    candidateSummary(
      candidate,
      [{ ...note, buildingVerdict: { value: "clear", createdAt: note.createdAt } }],
      [],
    ).state,
  ).toBe("unchecked");
  expect(candidateSummary(candidate, [note], [], false).state).toBe("unchecked");
});
it("does not treat an agent reply as a new approval or resolution as a verdict", () => {
  const report = {
    ...note,
    status: "pending" as const,
    buildingVerdict: { value: "changes" as const, createdAt: note.createdAt },
  };
  const reply = {
    ...report,
    id: "two",
    status: "resolved" as const,
    reply: "Implemented",
    createdAt: "2026-10-02T00:00:00Z",
  };
  expect(candidateSummary(candidate, [report, reply], []).state).toBe("changes");
  expect(pendingRequests([report, reply], [])).toHaveLength(0);
});

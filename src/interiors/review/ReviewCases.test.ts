import { describe, expect, it } from "vitest";
import { parseFloorPlan } from "../ApartmentFloorPlan.js";
import { REVIEW_STAGES, reviewCases } from "./ReviewCases.js";
import { currentVerdict, parseReviewFeedback, type ReviewFeedback } from "./ReviewFeedback.js";

describe("review coverage", () => {
  it("has reproducible unique sketches and IDs, spanning small rooms through apartments", () => {
    const cases = reviewCases();
    expect(cases).toEqual(reviewCases());
    expect(cases.length).toBeGreaterThan(60);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    expect(new Set(cases.map((c) => c.sketch)).size).toBe(cases.length);
    expect(new Set(cases.map((c) => c.sketch.replace(/[BKTH]/g, "L"))).size).toBe(cases.length);
    expect(new Set(cases.map((c) => c.stage)).size).toBe(REVIEW_STAGES.length);
    for (const c of cases) expect(() => parseFloorPlan(c.sketch), c.name).not.toThrow();
    const smallest = parseFloorPlan(cases[0]?.sketch ?? "");
    expect([smallest.width, smallest.height]).toEqual([3, 3]);
  });
});
const record: ReviewFeedback = {
  id: "test-1",
  caseId: "case-1",
  fingerprint: "a".repeat(64),
  verdict: "wrong",
  note: "",
  sketch: "###\n#L#\n###",
  name: "Tiny room",
  createdAt: "2026-09-28T12:00:00Z",
};
describe("review verdict validity", () => {
  it("keeps unchanged judgments, expires changed pixels, and honors undo", () => {
    expect(currentVerdict([record], record.caseId, record.fingerprint)?.verdict).toBe("wrong");
    expect(currentVerdict([record], record.caseId, "b".repeat(64))).toBeUndefined();
    expect(
      currentVerdict(
        [record, { ...record, id: "test-2", verdict: "clear" }],
        record.caseId,
        record.fingerprint,
      ),
    ).toBeUndefined();
    expect(
      currentVerdict(
        [record, { ...record, id: "test-2", fingerprint: "b".repeat(64), verdict: "good" }],
        record.caseId,
        record.fingerprint,
      ),
    ).toBeUndefined();
  });
  it("accepts a one-click report without a note, but rejects oversized or malformed input", () => {
    expect(parseReviewFeedback(record)).toEqual(record);
    expect(() => parseReviewFeedback({ ...record, verdict: "maybe" })).toThrow();
    expect(() => parseReviewFeedback({ ...record, note: "x".repeat(2001) })).toThrow();
    expect(() =>
      parseReviewFeedback({ ...record, screenshot: "https://example.com/image" }),
    ).toThrow();
  });
});

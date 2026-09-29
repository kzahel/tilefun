import { describe, expect, it } from "vitest";
import { buildLayeredApartmentPlan } from "../ApartmentArchitecture.js";
import { parseFloorPlan } from "../ApartmentFloorPlan.js";
import { buildProfileApartmentPlan } from "../ApartmentWallProfiles.js";
import { boundaryReviewCases } from "./BoundaryReviewCases.js";
import { connectionReviewCases } from "./ConnectionReviewCases.js";
import { interactionReviewCases } from "./InteractionReviewCases.js";
import { REVIEW_STAGES, reviewCases } from "./ReviewCases.js";
import { currentVerdict, parseReviewFeedback, type ReviewFeedback } from "./ReviewFeedback.js";

describe("review coverage", () => {
  it("completes all twelve north/south height and width combinations in compact cases", () => {
    const cases = boundaryReviewCases();
    expect(cases).toHaveLength(8);
    const combinations = new Set<string>();
    const attachments = [
      ...cases,
      ...connectionReviewCases().filter((c) => /connection-(north|south)-/.test(c.id)),
    ];
    for (const c of attachments) {
      const side = c.id.includes("north") ? "north" : "south";
      const w = c.profiles.walls[0];
      if (!w) throw new Error("Empty attachment");
      combinations.add(`${side}-${w.height}-${w.thickness ?? "thin"}`);
      const map = buildProfileApartmentPlan(parseFloorPlan(c.sketch), c.profiles);
      expect(map.width * 16).toBeLessThanOrEqual(256);
      expect(map.pixelHeight).toBeLessThanOrEqual(256);
      for (const s of map.surfaces)
        for (const [x, y] of s.points) {
          expect(x, c.id).toBeGreaterThanOrEqual(0);
          expect(x, c.id).toBeLessThan(map.width * 16);
          expect(y + (map.contentOffsetY ?? 0), c.id).toBeGreaterThanOrEqual(0);
          expect(y + (map.contentOffsetY ?? 0), c.id).toBeLessThan(map.pixelHeight);
        }
    }
    expect(combinations.size).toBe(12);
  });
  it("adds three compact eight-case rounds with connected whole-room floor plans", () => {
    const cases = interactionReviewCases();
    for (const stage of [9, 10, 11]) expect(cases.filter((c) => c.stage === stage)).toHaveLength(8);
    for (const c of cases) {
      const plan = parseFloorPlan(c.sketch);
      const map = buildProfileApartmentPlan(plan, c.profiles);
      expect(map.width * 16).toBeLessThanOrEqual(288);
      expect(map.pixelHeight).toBeLessThanOrEqual(288);
      for (const surface of map.surfaces)
        for (const [x, y] of surface.points) {
          expect(x, c.id).toBeGreaterThanOrEqual(0);
          expect(x, c.id).toBeLessThan(map.width * 16);
          expect(y + (map.contentOffsetY ?? 0), c.id).toBeGreaterThanOrEqual(0);
          expect(y + (map.contentOffsetY ?? 0), c.id).toBeLessThan(map.pixelHeight);
        }
      if (c.stage !== 11) continue;
      const floors = new Set<string>();
      plan.rows.forEach((row, y) => {
        row.forEach((cell, x) => {
          if (cell === "L" || cell === "+") floors.add(`${x},${y}`);
        });
      });
      const start = [...floors][0];
      if (!start) throw new Error("Empty composition");
      const reached = new Set([start]),
        queue = [start];
      for (let i = 0; i < queue.length; i++) {
        const point = queue[i];
        if (!point) continue;
        const [x = 0, y = 0] = point.split(",").map(Number);
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const next = `${x + dx},${y + dy}`;
          if (floors.has(next) && !reached.has(next)) {
            reached.add(next);
            queue.push(next);
          }
        }
      }
      expect(reached.size, c.id).toBe(floors.size);
    }
  });
  it("has reproducible unique sketches and IDs, spanning small rooms through apartments", () => {
    const cases = reviewCases();
    expect(cases).toEqual(reviewCases());
    expect(cases.length).toBeGreaterThan(60);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    const identity = (c: (typeof cases)[number]) =>
      c.sketch.replace(/[BKTH]/g, "L") + JSON.stringify(c.profiles ?? null);
    expect(new Set(cases.map(identity)).size).toBe(cases.length);
    expect(new Set(cases.map((c) => c.stage)).size).toBe(REVIEW_STAGES.length);
    for (const c of cases) {
      expect(
        () =>
          c.profiles
            ? buildProfileApartmentPlan(parseFloorPlan(c.sketch), c.profiles)
            : buildLayeredApartmentPlan(parseFloorPlan(c.sketch)),
        c.name,
      ).not.toThrow();
    }
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
  it("keeps bounded render and emoji pins while accepting older reports without pins", () => {
    const pins = [
      { x: 16, y: 32, size: 16 },
      { x: 32, y: 32, size: 32 },
    ];
    expect(parseReviewFeedback({ ...record, pins }).pins).toEqual(pins);
    expect(parseReviewFeedback({ ...record, pins: [{ x: 32, y: 48, size: 32 }] }).pins).toEqual([
      { x: 32, y: 48, size: 32 },
    ]);
    for (const bad of [
      null,
      [{ x: -16, y: 0, size: 16 }],
      [{ x: 96, y: 0, size: 32 }],
      [{ x: 0, y: 96, size: 16 }],
      [{ x: 1, y: 0, size: 16 }],
      [{ x: 0, y: 0, size: 8 }],
      Array(21).fill(pins[0]),
    ]) {
      expect(() => parseReviewFeedback({ ...record, pins: bad })).toThrow();
    }
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

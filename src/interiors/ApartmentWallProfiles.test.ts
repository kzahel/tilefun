import { describe, expect, it } from "vitest";
import { parseFloorPlan } from "./ApartmentFloorPlan.js";
import { buildProfileApartmentPlan } from "./ApartmentWallProfiles.js";
import { profileReviewCases } from "./review/ProfileReviewCases.js";
import { parseReviewFeedback } from "./review/ReviewFeedback.js";

describe("experimental wall profiles", () => {
  it.each([
    "profile-door-false",
    "profile-door-true",
  ])("joins %s to a straight room shell without a legacy branch", (id) => {
    const c = profileReviewCases().find((c) => c.id === id);
    if (!c) throw new Error("Missing attachment fixture");
    const map = buildProfileApartmentPlan(parseFloorPlan(c.sketch), c.profiles);
    // The old compiler emitted a full-height T here even when the branch was low.
    for (const y of [6, 7])
      expect(map.cells[y]?.[0]?.wall[0]?.key).toBe("room-builder/3d-walls/c10-r02");
    const height = id.endsWith("false") ? 8 : 40;
    expect(
      map.surfaces.some(
        (s) =>
          s.plane === `top:${height}` &&
          s.points.some(([x, y]) => x === 16 - height / 4 && y === 120 - height),
      ),
    ).toBe(true);
    for (const y of [6, 7])
      for (const x of [6, 7]) expect(map.cells[y]?.[x]?.semantic).toBe("opening");
  });
  it("changes elevation without changing the footprint or wall semantics", () => {
    const cases = profileReviewCases().slice(0, 3);
    const maps = cases.map((c) => buildProfileApartmentPlan(parseFloorPlan(c.sketch), c.profiles));
    expect(maps.map((m) => m.surfaces?.filter((s) => s.plane.startsWith("top:")).length)).toEqual([
      9, 9, 9,
    ]);
    const top = maps.map((m) => Math.min(...m.surfaces.flatMap((s) => s.points.map((p) => p[1]))));
    expect(top).toEqual([96, 112, 80]);
    for (const map of maps) expect(map.cells[6]?.[6]?.semantic).toBe("wall");
  });
  it("removes coplanar edges but retains the outside boundary", () => {
    const c = profileReviewCases()[0];
    if (!c) throw new Error("Missing profile fixture");
    const map = buildProfileApartmentPlan(parseFloorPlan(c.sketch), c.profiles);
    const tops = map.surfaces.filter((s) => s.plane.startsWith("top:"));
    expect(tops.reduce((n, s) => n + s.edges.filter(Boolean).length, 0)).toBe(20);
    expect(map.surfaces.some((s) => s.plane.startsWith("south:"))).toBe(true);
  });
  it("keeps new surfaces within their compact review canvas", () => {
    for (const c of profileReviewCases()) {
      const map = buildProfileApartmentPlan(parseFloorPlan(c.sketch), c.profiles);
      for (const s of map.surfaces)
        for (const [x, y] of s.points) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThan(map.width * 16);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThan(map.pixelHeight);
        }
    }
  });
  it("saves the height specification with feedback and rejects invalid heights", () => {
    const c = profileReviewCases()[0];
    if (!c) throw new Error("Missing profile fixture");
    const r = {
      id: "test-profile",
      caseId: c.id,
      name: c.name,
      sketch: c.sketch,
      profiles: c.profiles,
      fingerprint: "a".repeat(64),
      verdict: "wrong",
      note: "",
      createdAt: "2026-09-29T00:00:00Z",
    };
    expect(parseReviewFeedback(r).profiles).toEqual(c.profiles);
    expect(() =>
      parseReviewFeedback({ ...r, profiles: { walls: [{ x: 2, y: 3, height: "giant" }] } }),
    ).toThrow("Invalid wall profiles");
    expect(() =>
      buildProfileApartmentPlan(parseFloorPlan(c.sketch), {
        walls: [{ x: 1, y: 1, height: "low" }],
      }),
    ).toThrow();
  });
});

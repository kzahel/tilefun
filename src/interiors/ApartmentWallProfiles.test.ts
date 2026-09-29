import { describe, expect, it } from "vitest";
import { parseFloorPlan } from "./ApartmentFloorPlan.js";
import { buildProfileApartmentPlan } from "./ApartmentWallProfiles.js";
import { connectionReviewCases } from "./review/ConnectionReviewCases.js";
import { profileReviewCases } from "./review/ProfileReviewCases.js";
import { parseReviewFeedback } from "./review/ReviewFeedback.js";

describe("experimental wall profiles", () => {
  it("matches the tall east attachment to the shell's inward-facing perspective", () => {
    const c = profileReviewCases().find((c) => c.id === "profile-door-east-tall");
    if (!c) throw new Error("Missing east attachment fixture");
    const map = buildProfileApartmentPlan(parseFloorPlan(c.sketch), c.profiles);
    const top = map.surfaces.filter((s) => s.plane === "top:40");
    expect(top.some((s) => s.points.some(([x, y]) => x === 249 && y === 80))).toBe(true);
    expect(
      map.surfaces.some(
        (s) => s.plane === "south:16" && s.points.some(([x, y]) => x === 240 && y === 128),
      ),
    ).toBe(true);
    // The connected end must not emit the sloping exposed face of a free end.
    expect(map.surfaces.some((s) => s.plane === "east:31")).toBe(false);
  });
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
    for (const c of [...profileReviewCases(), ...connectionReviewCases()]) {
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

describe("wall thickness and end connections", () => {
  const fixture = (id: string) => {
    const c = connectionReviewCases().find((c) => c.id === `connection-${id}`);
    if (!c) throw new Error(`Missing connection ${id}`);
    return c;
  };
  const build = (id: string) => {
    const c = fixture(id);
    return buildProfileApartmentPlan(parseFloorPlan(c.sketch), c.profiles);
  };
  it("thickens toward north/west while keeping the south/east faces anchored", () => {
    const c = fixture("straight");
    const plan = parseFloorPlan(c.sketch);
    const maps = ["thin", "thick"].map((thickness) =>
      buildProfileApartmentPlan(plan, {
        walls: c.profiles.walls.map((w) => ({ ...w, thickness: thickness as "thin" | "thick" })),
      }),
    );
    const bounds = maps.map((m) => {
      const points = m.surfaces.filter((s) => s.plane === "top:24").flatMap((s) => s.points);
      return [
        Math.min(...points.map(([x]) => x)),
        Math.max(...points.map(([x]) => x)),
        Math.min(...points.map(([, y]) => y)),
        Math.max(...points.map(([, y]) => y)),
      ];
    });
    expect(bounds).toEqual([
      [74, 146, 96, 104],
      [66, 146, 88, 104],
    ]);
  });
  it("leaves a full 32px opening through the thick footprint", () => {
    const map = build("door");
    const tops = map.surfaces.filter((s) => s.plane === "top:24");
    // Undo the 6px elevation shear to inspect the ground footprint.
    const intervals = tops.map((s) => s.points.map(([x]) => x + 6));
    expect(intervals.every((xs) => Math.max(...xs) <= 128 || Math.min(...xs) >= 160)).toBe(true);
    expect(intervals.some((xs) => Math.max(...xs) === 128)).toBe(true);
    expect(intervals.some((xs) => Math.min(...xs) === 160)).toBe(true);
    for (const y of [6, 7])
      for (const x of [8, 9]) expect(map.cells[y]?.[x]?.semantic).toBe("opening");
  });
  it("joins the tall north cap without clipping or reversing its projected segments", () => {
    const tops = build("north-tall").surfaces.filter((s) => s.plane === "top:40");
    expect(Math.min(...tops.flatMap((s) => s.points.map(([, y]) => y)))).toBe(5);
    for (const s of tops) {
      const [nw, ne, se, sw] = s.points;
      if (!nw || !ne || !se || !sw) throw new Error("Incomplete cap");
      expect(sw[1]).toBeGreaterThan(nw[1]);
      expect(se[1]).toBeGreaterThan(ne[1]);
    }
  });
  it.each([
    "low",
    "tall",
  ])("joins the %s south end while preserving height above the low cutaway", (height) => {
    const map = build(`south-${height}`);
    const points = map.surfaces.flatMap((s) => s.points);
    expect(Math.max(...points.map(([, y]) => y))).toBe(224);
    const tops = map.surfaces.filter((s) => s.plane.startsWith("top:"));
    expect(Math.max(...tops.flatMap((s) => s.points.map(([, y]) => y)))).toBe(
      height === "low" ? 224 : 192,
    );
    const end = map.surfaces.filter((s) => s.plane === "south:28");
    expect(end).toHaveLength(height === "low" ? 0 : 4);
    if (height === "tall")
      expect(Math.min(...end.flatMap((s) => s.points.map(([, y]) => y)))).toBe(192);
    expect(map.pixelHeight).toBe(230);
    expect(map.cells[14]?.[6]?.foreground.length).toBeGreaterThan(0);
  });
  it.each([
    "low",
    "tall",
  ])("retains the exposed %s end when a partition stops before the shell", (height) => {
    const c = fixture(`south-${height}`);
    const sketch = c.sketch
      .split("\n")
      .map((row, y) => (y === 6 ? row.replace("#LL#LLL#", "#LLLLLL#") : row))
      .join("\n");
    const map = buildProfileApartmentPlan(parseFloorPlan(sketch), {
      walls: c.profiles.walls.filter((w) => w.y < 6),
    });
    expect(map.surfaces.some((s) => s.plane === "south:24")).toBe(true);
    expect(Math.max(...map.surfaces.flatMap((s) => s.points.map(([, y]) => y)))).toBe(192);
  });
  it("persists explicit thickness and rejects unsupported width specifications", () => {
    const c = fixture("straight");
    const r = {
      id: "test-width",
      caseId: c.id,
      name: c.name,
      sketch: c.sketch,
      profiles: c.profiles,
      fingerprint: "b".repeat(64),
      verdict: "wrong",
      note: "",
      createdAt: "2026-09-29T00:00:00Z",
    };
    expect(parseReviewFeedback(r).profiles).toEqual(c.profiles);
    expect(() =>
      parseReviewFeedback({
        ...r,
        profiles: { walls: [{ x: 2, y: 3, height: "normal", thickness: "wide" }] },
      }),
    ).toThrow("Invalid wall profiles");
  });
});

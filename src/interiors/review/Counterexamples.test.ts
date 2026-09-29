import { describe, expect, it } from "vitest";
import { parseFloorPlan } from "../ApartmentFloorPlan.js";
import { buildProfileApartmentPlan } from "../ApartmentWallProfiles.js";
import { auditCase, auditGeometry, auditOpenings } from "./CounterexampleAudit.js";
import { caseIdentity, generateProbe, PROBE_COUNT } from "./CounterexampleGenerator.js";
import {
  proposeVisualReduction,
  reduceFailure,
  reductionCost,
  smallerCases,
} from "./CounterexampleReducer.js";
import { searchCounterexamples } from "./CounterexampleSearch.js";
import { GENERATED_REVIEW_SEEDS } from "./GeneratedReviewCases.js";
import { reviewCases } from "./ReviewCases.js";

describe("offline counterexample search", () => {
  it("reproduces the selected round, rejects disconnected inputs, and balances new interactions", () => {
    const result = searchCounterexamples(reviewCases().filter((c) => c.stage < 14));
    expect(result.enumerated).toBe(PROBE_COUNT);
    expect(result.enumerated).toBe(
      result.duplicates + result.known + result.valid + result.failures.length,
    );
    expect(result.selected.map((c) => c.seed)).toEqual(GENERATED_REVIEW_SEEDS);
    expect(result.failures.length).toBeGreaterThan(0);
    expect(
      result.failures.every((f) => f.issues.every((i) => i.code === "disconnected-floor")),
    ).toBe(true);
    for (let family = 0; family < 4; family++)
      expect(result.selected.filter((c) => c.family === family)).toHaveLength(2);
    for (const { fixture, newFeatures } of result.selected) {
      expect(fixture).toEqual(generateProbe(fixture.seed));
      expect(newFeatures).toBeGreaterThan(0);
      expect(auditCase(fixture)).toEqual([]);
    }
  }, 30000);

  it("deduplicates profile ordering and palette changes while preserving handedness", () => {
    const c = generateProbe(65);
    const equivalent = {
      ...c,
      id: "different",
      sketch: c.sketch.replace(/L/g, "B"),
      profiles: { walls: [...c.profiles.walls].reverse() },
    };
    expect(caseIdentity(equivalent)).toBe(caseIdentity(c));
    expect(caseIdentity(generateProbe(65 + PROBE_COUNT / 2))).not.toBe(caseIdentity(c));
    for (const seed of [-1, PROBE_COUNT, 1.5, NaN]) expect(() => generateProbe(seed)).toThrow();
  });
});

describe("structural audit", () => {
  const compile = () => {
    const fixture = generateProbe(267);
    const plan = parseFloorPlan(fixture.sketch);
    return { fixture, plan, map: buildProfileApartmentPlan(plan, fixture.profiles, true) };
  };
  it("adds provenance only when requested and leaves rendering data unchanged", () => {
    const { fixture, plan, map } = compile();
    const { profileGeometry, ...render } = map;
    expect(profileGeometry?.faces.length).toBeGreaterThan(0);
    expect(buildProfileApartmentPlan(plan, fixture.profiles)).toEqual(render);
    expect(auditGeometry(map)).toEqual([]);
  });
  it("detects missing, duplicated, internal, and out-of-bounds surfaces", () => {
    const { map } = compile();
    const geometry = map.profileGeometry;
    const face = geometry?.faces[0],
      surface = map.surfaces[0];
    if (!geometry || !face || !surface) throw new Error("Missing geometry");
    const missing = structuredClone(map);
    missing.profileGeometry?.faces.shift();
    missing.surfaces.shift();
    expect(auditGeometry(missing).map((i) => i.code)).toContain("missing-face");
    geometry.faces.push({ ...face });
    map.surfaces.push(structuredClone(surface));
    expect(auditGeometry(map).map((i) => i.code)).toContain("duplicate-face");
    geometry.faces[geometry.faces.length - 1] = { ...face, top: 1000 };
    expect(auditGeometry(map).map((i) => i.code)).toContain("internal-face");
    surface.points[0] = [-1, 0];
    expect(auditGeometry(map).map((i) => i.code)).toContain("bounds");
  });
  it("detects physical and tile-layer doorway blockages", () => {
    const { fixture, plan, map } = compile();
    const y = plan.rows.findIndex((r) => r.includes("+")),
      x = plan.rows[y]?.indexOf("+") ?? -1;
    expect(auditOpenings(plan, map, fixture.profiles)).toEqual([]);
    map.profileGeometry?.columns.push({ x: x * 4, y: y * 4, height: 8 });
    expect(auditOpenings(plan, map, fixture.profiles).map((i) => i.code)).toContain(
      "blocked-opening",
    );
    map.profileGeometry?.columns.pop();
    const cell = map.cells[y * 2]?.[x * 2];
    if (!cell) throw new Error("Missing opening");
    cell.wall.push({ key: "injected-wall" });
    expect(auditOpenings(plan, map, fixture.profiles).map((i) => i.code)).toContain(
      "blocked-opening",
    );
  });
});

describe("counterexample reduction", () => {
  const disconnected = (c: ReturnType<typeof reviewCases>[number]) =>
    auditCase(c).some((i) => i.code === "disconnected-floor");
  it("shrinks a real rejected input and retains its structural failure", () => {
    const original = generateProbe(0);
    const result = reduceFailure(original, disconnected);
    expect(reductionCost(result.fixture)).toBeLessThan(reductionCost(original));
    expect(disconnected(result.fixture)).toBe(true);
    expect(result.minimal).toBe(true);
    expect(smallerCases(result.fixture).some(disconnected)).toBe(false);
    expect(result.fixture.relatedCaseId).toBe(original.id);
    expect(reduceFailure(original, disconnected, 1).minimal).toBe(false);
    expect(() => reduceFailure(generateProbe(65), disconnected)).toThrow(/Original/);
  });
  it("requires human confirmation of visual reductions and retains the pinned neighborhood", () => {
    const c = generateProbe(267),
      pin: [number, number] = [3, 3];
    const result = proposeVisualReduction(c, [pin]);
    expect(result.needsVisualConfirmation).toBe(true);
    expect(auditCase(result.fixture)).toEqual([]);
    expect(reductionCost(result.fixture)).toBeLessThan(reductionCost(c));
    const neighborhood = (sketch: string) =>
      sketch
        .split("\n")
        .slice(2, 5)
        .map((r) => r.slice(2, 5));
    expect(neighborhood(result.fixture.sketch)).toEqual(neighborhood(c.sketch));
    for (const w of c.profiles.walls.filter(
      (w) => Math.abs(w.x - pin[0]) <= 1 && Math.abs(w.y - pin[1]) <= 1,
    ))
      expect(result.fixture.profiles?.walls).toContainEqual(w);
    expect(() => proposeVisualReduction(c, [])).toThrow(/pin/);
    expect(() => proposeVisualReduction(c, [[999, 0]])).toThrow(/outside/);
  });
});

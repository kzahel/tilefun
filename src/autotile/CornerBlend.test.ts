import { describe, expect, it } from "vitest";
import { AutotileBit } from "./bitmask.js";
import { computeCornerMask } from "./CornerBlend.js";

describe("computeCornerMask", () => {
  it("all corners in → full mask 255", () => {
    expect(computeCornerMask(true, true, true, true)).toBe(255);
  });

  it("no corners in → mask 0", () => {
    expect(computeCornerMask(false, false, false, false)).toBe(0);
  });

  it("single NW corner → no cardinals or diagonals (isolated corner)", () => {
    // NW alone: N requires nw&&ne (ne=false), W requires nw&&sw (sw=false)
    expect(computeCornerMask(true, false, false, false)).toBe(0);
  });

  it("single NE corner → no cardinals", () => {
    expect(computeCornerMask(false, true, false, false)).toBe(0);
  });

  it("single SW corner → no cardinals", () => {
    expect(computeCornerMask(false, false, true, false)).toBe(0);
  });

  it("single SE corner → no cardinals", () => {
    expect(computeCornerMask(false, false, false, true)).toBe(0);
  });

  it("north edge (NW + NE) → N cardinal only", () => {
    expect(computeCornerMask(true, true, false, false)).toBe(AutotileBit.N);
  });

  it("south edge (SW + SE) → S cardinal only", () => {
    expect(computeCornerMask(false, false, true, true)).toBe(AutotileBit.S);
  });

  it("west edge (NW + SW) → W cardinal only", () => {
    expect(computeCornerMask(true, false, true, false)).toBe(AutotileBit.W);
  });

  it("east edge (NE + SE) → E cardinal only", () => {
    expect(computeCornerMask(false, true, false, true)).toBe(AutotileBit.E);
  });

  it("3 corners (all except SE) → N + W + NW diagonal", () => {
    const mask = computeCornerMask(true, true, true, false);
    // N = nw&&ne = true, W = nw&&sw = true, E = ne&&se = false, S = sw&&se = false
    // NW = N&&W&&nw = true, NE = N&&E&&ne = false, SW = S&&W&&sw = false
    expect(mask).toBe(AutotileBit.N | AutotileBit.W | AutotileBit.NW);
  });

  it("3 corners (all except SW) → N + E + NE diagonal", () => {
    const mask = computeCornerMask(true, true, false, true);
    expect(mask).toBe(AutotileBit.N | AutotileBit.E | AutotileBit.NE);
  });

  it("3 corners (all except NE) → W + S + SW diagonal", () => {
    const mask = computeCornerMask(true, false, true, true);
    expect(mask).toBe(AutotileBit.W | AutotileBit.S | AutotileBit.SW);
  });

  it("3 corners (all except NW) → E + S + SE diagonal", () => {
    const mask = computeCornerMask(false, true, true, true);
    expect(mask).toBe(AutotileBit.E | AutotileBit.S | AutotileBit.SE);
  });

  it("diagonal corners (NW + SE) → no cardinals, no diagonals", () => {
    // N = nw&&ne = false, E = ne&&se = false, S = sw&&se = false, W = nw&&sw = false
    expect(computeCornerMask(true, false, false, true)).toBe(0);
  });

  it("diagonal corners (NE + SW) → no cardinals, no diagonals", () => {
    expect(computeCornerMask(false, true, true, false)).toBe(0);
  });

  it("top-left L-shape (NW + NE + SW) → N + W + NW", () => {
    const mask = computeCornerMask(true, true, true, false);
    expect(mask).toBe(AutotileBit.N | AutotileBit.W | AutotileBit.NW);
  });

  it("all corners produces a canonical mask", () => {
    // Verify it matches the expected fully-filled blob mask
    const mask = computeCornerMask(true, true, true, true);
    expect(mask).toBe(
      AutotileBit.N |
        AutotileBit.W |
        AutotileBit.E |
        AutotileBit.S |
        AutotileBit.NW |
        AutotileBit.NE |
        AutotileBit.SW |
        AutotileBit.SE,
    );
  });
});

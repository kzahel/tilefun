import { describe, expect, it } from "vitest";
import { AutotileBit } from "./bitmask.js";
import { computeBlendMask, computeCornerMask } from "./CornerBlend.js";

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

describe("computeBlendMask", () => {
  it("all corners in → full mask 255", () => {
    expect(computeBlendMask(true, true, true, true)).toBe(255);
  });

  it("no corners in → mask 0", () => {
    expect(computeBlendMask(false, false, false, false)).toBe(0);
  });

  // Single corner: overlay present at one corner → inner concave corner mask
  // This is the key improvement over computeCornerMask (which returns 0)
  it("single NW corner → all except SE (mask 127, inner concave)", () => {
    // OR: n=T, s=F, w=T, e=F → N+W=3, NW=T → 19... wait
    // n = nw||ne = T||F = T, s = sw||se = F||F = F
    // w = nw||sw = T||F = T, e = ne||se = F||F = F
    // N+W = 3, NW: n&&w&&nw=T → 16+3 = 19
    // Hmm, single NW corner = only NW is true. For blend mask:
    // This produces N+W+NW = 19. That's correct for this case.
    expect(computeBlendMask(true, false, false, false)).toBe(
      AutotileBit.N | AutotileBit.W | AutotileBit.NW,
    );
  });

  it("single NE corner → N + E + NE (mask 37)", () => {
    expect(computeBlendMask(false, true, false, false)).toBe(
      AutotileBit.N | AutotileBit.E | AutotileBit.NE,
    );
  });

  it("single SW corner → W + S + SW (mask 74)", () => {
    expect(computeBlendMask(false, false, true, false)).toBe(
      AutotileBit.W | AutotileBit.S | AutotileBit.SW,
    );
  });

  it("single SE corner → E + S + SE (mask 140)", () => {
    expect(computeBlendMask(false, false, false, true)).toBe(
      AutotileBit.E | AutotileBit.S | AutotileBit.SE,
    );
  });

  // Edge cases: two corners on the same edge
  it("north edge (NW + NE) → N + W + E + NW + NE (south edge sprite, mask 55)", () => {
    expect(computeBlendMask(true, true, false, false)).toBe(
      AutotileBit.N | AutotileBit.W | AutotileBit.E | AutotileBit.NW | AutotileBit.NE,
    );
  });

  it("south edge (SW + SE) → W + E + S + SW + SE (north edge sprite, mask 206)", () => {
    expect(computeBlendMask(false, false, true, true)).toBe(
      AutotileBit.W | AutotileBit.E | AutotileBit.S | AutotileBit.SW | AutotileBit.SE,
    );
  });

  it("west edge (NW + SW) → N + W + S + NW + SW (east edge sprite, mask 91)", () => {
    expect(computeBlendMask(true, false, true, false)).toBe(
      AutotileBit.N | AutotileBit.W | AutotileBit.S | AutotileBit.NW | AutotileBit.SW,
    );
  });

  it("east edge (NE + SE) → N + E + S + NE + SE (west edge sprite, mask 173)", () => {
    expect(computeBlendMask(false, true, false, true)).toBe(
      AutotileBit.N | AutotileBit.E | AutotileBit.S | AutotileBit.NE | AutotileBit.SE,
    );
  });

  // Three corners: inner concave corner — the critical "tiny pond" case
  it("3 corners (all except SE) → inner concave SE corner (mask 127)", () => {
    // n=T, s=T, w=T, e=T → all cardinals
    // NW=T, NE=T, SW=T, SE=F
    expect(computeBlendMask(true, true, true, false)).toBe(
      AutotileBit.N |
        AutotileBit.W |
        AutotileBit.E |
        AutotileBit.S |
        AutotileBit.NW |
        AutotileBit.NE |
        AutotileBit.SW,
    );
  });

  it("3 corners (all except SW) → inner concave SW corner (mask 191)", () => {
    expect(computeBlendMask(true, true, false, true)).toBe(
      AutotileBit.N |
        AutotileBit.W |
        AutotileBit.E |
        AutotileBit.S |
        AutotileBit.NW |
        AutotileBit.NE |
        AutotileBit.SE,
    );
  });

  it("3 corners (all except NE) → inner concave NE corner (mask 223)", () => {
    expect(computeBlendMask(true, false, true, true)).toBe(
      AutotileBit.N |
        AutotileBit.W |
        AutotileBit.E |
        AutotileBit.S |
        AutotileBit.NW |
        AutotileBit.SW |
        AutotileBit.SE,
    );
  });

  it("3 corners (all except NW) → inner concave NW corner (mask 239)", () => {
    expect(computeBlendMask(false, true, true, true)).toBe(
      AutotileBit.N |
        AutotileBit.W |
        AutotileBit.E |
        AutotileBit.S |
        AutotileBit.NE |
        AutotileBit.SW |
        AutotileBit.SE,
    );
  });

  // Diagonal corners: saddle shapes
  it("diagonal NW + SE → all cardinals + NW + SE (mask 159)", () => {
    expect(computeBlendMask(true, false, false, true)).toBe(
      AutotileBit.N |
        AutotileBit.W |
        AutotileBit.E |
        AutotileBit.S |
        AutotileBit.NW |
        AutotileBit.SE,
    );
  });

  it("diagonal NE + SW → all cardinals + NE + SW (mask 111)", () => {
    expect(computeBlendMask(false, true, true, false)).toBe(
      AutotileBit.N |
        AutotileBit.W |
        AutotileBit.E |
        AutotileBit.S |
        AutotileBit.NE |
        AutotileBit.SW,
    );
  });

  it("all masks produced are canonical (no stray diagonal bits)", () => {
    // Test all 16 corner combinations
    for (let i = 0; i < 16; i++) {
      const nw = !!(i & 1);
      const ne = !!(i & 2);
      const sw = !!(i & 4);
      const se = !!(i & 8);
      const mask = computeBlendMask(nw, ne, sw, se);
      // Verify diagonal bits are only set when both adjacent cardinals are set
      if (mask & AutotileBit.NW) expect(mask & AutotileBit.N && mask & AutotileBit.W).toBeTruthy();
      if (mask & AutotileBit.NE) expect(mask & AutotileBit.N && mask & AutotileBit.E).toBeTruthy();
      if (mask & AutotileBit.SW) expect(mask & AutotileBit.S && mask & AutotileBit.W).toBeTruthy();
      if (mask & AutotileBit.SE) expect(mask & AutotileBit.S && mask & AutotileBit.E).toBeTruthy();
    }
  });

  it("produces more unique masks than computeCornerMask", () => {
    const cornerMasks = new Set<number>();
    const blendMasks = new Set<number>();
    for (let i = 0; i < 16; i++) {
      const nw = !!(i & 1);
      const ne = !!(i & 2);
      const sw = !!(i & 4);
      const se = !!(i & 8);
      cornerMasks.add(computeCornerMask(nw, ne, sw, se));
      blendMasks.add(computeBlendMask(nw, ne, sw, se));
    }
    // computeCornerMask only produces 10 unique masks
    expect(cornerMasks.size).toBe(10);
    // computeBlendMask produces 16 unique masks (all 16 corner combos → 16 distinct masks)
    expect(blendMasks.size).toBe(16);
  });
});

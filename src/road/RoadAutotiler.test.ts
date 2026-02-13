import { describe, expect, it } from "vitest";
import { computeRoadCardinalMask, getRoadSprite, nsewToBlobMask } from "./RoadAutotiler.js";

describe("computeRoadCardinalMask", () => {
  it("returns 0 when no neighbors match center", () => {
    expect(computeRoadCardinalMask(1, 0, 0, 0, 0)).toBe(0);
  });

  it("returns full mask when all neighbors match", () => {
    // N=1, W=2, E=4, S=8 → all = 15
    expect(computeRoadCardinalMask(2, 2, 2, 2, 2)).toBe(15);
  });

  it("sets N bit when north matches", () => {
    expect(computeRoadCardinalMask(1, 1, 0, 0, 0)).toBe(1);
  });

  it("sets E bit when east matches", () => {
    expect(computeRoadCardinalMask(1, 0, 1, 0, 0)).toBe(4);
  });

  it("sets S bit when south matches", () => {
    expect(computeRoadCardinalMask(1, 0, 0, 1, 0)).toBe(8);
  });

  it("sets W bit when west matches", () => {
    expect(computeRoadCardinalMask(1, 0, 0, 0, 1)).toBe(2);
  });

  it("handles partial matches (N+S = vertical)", () => {
    expect(computeRoadCardinalMask(3, 3, 0, 3, 0)).toBe(9); // N+S
  });

  it("handles partial matches (W+E = horizontal)", () => {
    expect(computeRoadCardinalMask(3, 0, 3, 0, 3)).toBe(6); // W+E
  });

  it("handles T-junction (N+E+S)", () => {
    expect(computeRoadCardinalMask(1, 1, 1, 1, 0)).toBe(13); // N+E+S
  });
});

describe("nsewToBlobMask", () => {
  it("returns 0 for isolated tile", () => {
    expect(nsewToBlobMask(0)).toBe(0);
  });

  it("passes through single cardinal bits unchanged", () => {
    expect(nsewToBlobMask(1)).toBe(1); // N only
    expect(nsewToBlobMask(2)).toBe(2); // W only
    expect(nsewToBlobMask(4)).toBe(4); // E only
    expect(nsewToBlobMask(8)).toBe(8); // S only
  });

  it("sets NW diagonal when N+W present", () => {
    expect(nsewToBlobMask(3)).toBe(3 | 16); // N+W → +NW
  });

  it("sets NE diagonal when N+E present", () => {
    expect(nsewToBlobMask(5)).toBe(5 | 32); // N+E → +NE
  });

  it("sets SW diagonal when S+W present", () => {
    expect(nsewToBlobMask(10)).toBe(10 | 64); // S+W → +SW
  });

  it("sets SE diagonal when S+E present", () => {
    expect(nsewToBlobMask(12)).toBe(12 | 128); // S+E → +SE
  });

  it("fills all diagonals for full cardinal mask", () => {
    // N+W+E+S = 15 → all 4 diagonals set = 255
    expect(nsewToBlobMask(15)).toBe(255);
  });

  it("only fills diagonal when both adjacent cardinals present", () => {
    // N+E = 5 → NE set, but NW not set (no W)
    const result = nsewToBlobMask(5);
    expect(result & 32).toBeTruthy(); // NE set
    expect(result & 16).toBeFalsy(); // NW not set
  });
});

describe("getRoadSprite", () => {
  it("returns isolated tile sprite for mask 0", () => {
    const sprite = getRoadSprite(0);
    // mask 0 → blob 0 → (col=11, row=3) per GM_BLOB_47
    expect(sprite.col).toBe(11);
    expect(sprite.row).toBe(3);
  });

  it("returns full interior for all-cardinal mask 15", () => {
    // mask 15 → blob 255 → (col=1, row=0)
    const sprite = getRoadSprite(15);
    expect(sprite.col).toBe(1);
    expect(sprite.row).toBe(0);
  });

  it("returns vertical corridor for N+S", () => {
    // mask 9 (N+S) → blob 9 → (col=9, row=2)
    const sprite = getRoadSprite(9);
    expect(sprite.col).toBe(9);
    expect(sprite.row).toBe(2);
  });

  it("returns horizontal corridor for W+E", () => {
    // mask 6 (W+E) → blob 6 → (col=10, row=2)
    const sprite = getRoadSprite(6);
    expect(sprite.col).toBe(10);
    expect(sprite.row).toBe(2);
  });

  it("returns correct sprite for each single cardinal", () => {
    // N=1 → blob 1 → (col=9, row=3)
    expect(getRoadSprite(1)).toEqual({ col: 9, row: 3 });
    // W=2 → blob 2 → (col=10, row=3)
    expect(getRoadSprite(2)).toEqual({ col: 10, row: 3 });
    // E=4 → blob 4 → (col=8, row=3)
    expect(getRoadSprite(4)).toEqual({ col: 8, row: 3 });
    // S=8 → blob 8 → (col=7, row=3)
    expect(getRoadSprite(8)).toEqual({ col: 7, row: 3 });
  });

  it("returns correct sprite for L-corners", () => {
    // N+E=5 → blob 37 (5|32) → (col=5, row=3)
    expect(getRoadSprite(5)).toEqual({ col: 5, row: 3 });
    // N+W=3 → blob 19 (3|16) → (col=3, row=3)
    expect(getRoadSprite(3)).toEqual({ col: 3, row: 3 });
    // S+E=12 → blob 140 (12|128) → (col=11, row=2)
    expect(getRoadSprite(12)).toEqual({ col: 11, row: 2 });
    // S+W=10 → blob 74 (10|64) → (col=1, row=3)
    expect(getRoadSprite(10)).toEqual({ col: 1, row: 3 });
  });

  it("returns correct sprite for T-junctions", () => {
    // N+W+E=7 → blob 55 (7|16|32) → (col=5, row=2)
    expect(getRoadSprite(7)).toEqual({ col: 5, row: 2 });
    // N+W+S=11 → blob 91 (11|16|64) → (col=1, row=2)
    expect(getRoadSprite(11)).toEqual({ col: 1, row: 2 });
    // N+E+S=13 → blob 173 (13|32|128) → (col=5, row=1)
    expect(getRoadSprite(13)).toEqual({ col: 5, row: 1 });
    // W+E+S=14 → blob 206 (14|64|128) → (col=9, row=1)
    expect(getRoadSprite(14)).toEqual({ col: 9, row: 1 });
  });
});

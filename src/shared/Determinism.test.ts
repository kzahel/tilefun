import { describe, expect, it } from "vitest";
import { fnv1a32, lcgNext, positionSeed } from "./Determinism.js";

// Values were computed from the inline implementations these helpers replaced.
describe("Determinism", () => {
  it("pins the LCG sequence", () => {
    const sequence = (seed: number, length: number) =>
      Array.from({ length }, () => (seed = lcgNext(seed)));
    expect(sequence(0, 4)).toEqual([1013904223, 1196435762, 3519870697, 2868466484]);
    expect(sequence(1737, 3)).toEqual([3905184148, 3569147875, 677757926]);
    expect(lcgNext(4294967295)).toBe(1012239698);
    expect(lcgNext(123456789)).toBe(920370032);
  });

  it("pins position seeds", () => {
    expect(positionSeed(100.7, -40.2, 7601)).toBe(1753337708);
    expect(positionSeed(0, 0, 8137)).toBe(8137);
    expect(positionSeed(-12345.5, 67890.25, 7501)).toBe(1767119277);
    expect(positionSeed(512.9, 1024.1)).toBe(1357563392);
    expect(positionSeed(3e6, -2e6, 8001)).toBe(2130417665);
  });

  it("pins FNV-1a hashes", () => {
    expect(fnv1a32("")).toBe(2166136261);
    expect(fnv1a32("a")).toBe(3826002220);
    expect(fnv1a32("car-1:paint-v1")).toBe(2027008217);
    expect(fnv1a32("🚗x")).toBe(1910528048);
  });
});

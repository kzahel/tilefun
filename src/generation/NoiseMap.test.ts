import { describe, expect, it } from "vitest";
import { NoiseMap } from "./NoiseMap.js";

describe("NoiseMap", () => {
  it("returns deterministic output for the same seed", () => {
    const a = new NoiseMap("test-seed");
    const b = new NoiseMap("test-seed");
    expect(a.sample(10, 20)).toBe(b.sample(10, 20));
    expect(a.sample(-5, 100)).toBe(b.sample(-5, 100));
  });

  it("returns different output for different seeds", () => {
    const a = new NoiseMap("seed-a");
    const b = new NoiseMap("seed-b");
    expect(a.sample(10, 20)).not.toBe(b.sample(10, 20));
  });

  it("returns values in [0, 1] range", () => {
    const noise = new NoiseMap("range-test");
    for (let x = -50; x <= 50; x += 7) {
      for (let y = -50; y <= 50; y += 7) {
        const val = noise.sample(x, y);
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      }
    }
  });

  it("respects custom options", () => {
    const low = new NoiseMap("opts", { frequency: 0.001, octaves: 1 });
    const high = new NoiseMap("opts", { frequency: 0.1, octaves: 5 });
    // Different configs with same seed should produce different values
    // (except in the unlikely case of identical results)
    const valLow = low.sample(50, 50);
    const valHigh = high.sample(50, 50);
    expect(valLow).not.toBe(valHigh);
  });
});

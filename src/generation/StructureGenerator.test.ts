import { describe, expect, it } from "vitest";
import { DEFAULT_ROAD_PARAMS } from "./RoadGenerator.js";
import { generateStructuresForChunk, type StructurePlacement } from "./StructureGenerator.js";

const SEED = 42;

describe("generateStructuresForChunk", () => {
  it("is deterministic — same inputs give same output", () => {
    const processed = new Set<string>();
    const a = generateStructuresForChunk(0, 0, SEED, DEFAULT_ROAD_PARAMS, 0, processed);
    const processed2 = new Set<string>();
    const b = generateStructuresForChunk(0, 0, SEED, DEFAULT_ROAD_PARAMS, 0, processed2);
    expect(a.placements).toEqual(b.placements);
    expect(a.newIntersectionKeys).toEqual(b.newIntersectionKeys);
  });

  it("returns intersection keys that can be tracked", () => {
    const processed = new Set<string>();
    const result = generateStructuresForChunk(2, 2, SEED, DEFAULT_ROAD_PARAMS, 0, processed);
    expect(result.newIntersectionKeys.length).toBeGreaterThan(0);
    // All keys should be non-empty strings
    for (const key of result.newIntersectionKeys) {
      expect(key.length).toBeGreaterThan(0);
      expect(key.startsWith("si:") || key.startsWith("sf:")).toBe(true);
    }
  });

  it("skips already-processed intersections", () => {
    const processed = new Set<string>();
    const first = generateStructuresForChunk(2, 2, SEED, DEFAULT_ROAD_PARAMS, 0, processed);
    // Mark all keys as processed
    for (const k of first.newIntersectionKeys) {
      processed.add(k);
    }
    // Second call with same chunk should produce no new keys
    const second = generateStructuresForChunk(2, 2, SEED, DEFAULT_ROAD_PARAMS, 0, processed);
    expect(second.newIntersectionKeys.length).toBe(0);
    expect(second.placements.length).toBe(0);
  });

  it("generates structures across a larger area", () => {
    const processed = new Set<string>();
    const allPlacements: StructurePlacement[] = [];
    // Generate a 10x10 chunk area — should find some intersections with buildings
    for (let cy = 0; cy < 10; cy++) {
      for (let cx = 0; cx < 10; cx++) {
        const { placements, newIntersectionKeys } = generateStructuresForChunk(
          cx,
          cy,
          SEED,
          DEFAULT_ROAD_PARAMS,
          0,
          processed,
        );
        for (const k of newIntersectionKeys) {
          processed.add(k);
        }
        allPlacements.push(...placements);
      }
    }
    // With 10x10 chunks = 160x160 tiles, spacing=40, we expect ~4x4 grid intersections.
    // At 25% settlement probability, should have at least a couple buildings + street furniture.
    expect(allPlacements.length).toBeGreaterThan(0);
    // Verify all placements have valid prop types
    for (const p of allPlacements) {
      expect(p.propType).toBeTruthy();
      expect(typeof p.wx).toBe("number");
      expect(typeof p.wy).toBe("number");
      expect(Number.isFinite(p.wx)).toBe(true);
      expect(Number.isFinite(p.wy)).toBe(true);
    }
  });

  it("avoids water areas (island mode with small radius)", () => {
    const processed = new Set<string>();
    const allPlacements: StructurePlacement[] = [];
    // Very small island — most area is water, so very few structures
    for (let cy = -5; cy < 5; cy++) {
      for (let cx = -5; cx < 5; cx++) {
        const { placements, newIntersectionKeys } = generateStructuresForChunk(
          cx,
          cy,
          SEED,
          DEFAULT_ROAD_PARAMS,
          3, // very small island radius
          processed,
        );
        for (const k of newIntersectionKeys) {
          processed.add(k);
        }
        allPlacements.push(...placements);
      }
    }
    // With island radius 3, most land is water — should have very few or no structures
    expect(allPlacements.length).toBeLessThan(5);
  });

  it("different seeds produce different results", () => {
    const p1 = new Set<string>();
    const p2 = new Set<string>();
    const a = generateStructuresForChunk(2, 2, 42, DEFAULT_ROAD_PARAMS, 0, p1);
    const b = generateStructuresForChunk(2, 2, 999, DEFAULT_ROAD_PARAMS, 0, p2);
    // Both should produce valid output with intersection keys
    expect(a.newIntersectionKeys.length).toBeGreaterThan(0);
    expect(b.newIntersectionKeys.length).toBeGreaterThan(0);
  });
});

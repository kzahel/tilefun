import { describe, expect, it } from "vitest";
import { BlendGraph } from "./BlendGraph.js";
import { TerrainAdjacency } from "./TerrainAdjacency.js";
import { TerrainId } from "./TerrainId.js";

const graph = new BlendGraph();
const adj = new TerrainAdjacency(graph);

describe("TerrainAdjacency", () => {
  describe("isDedicatedAdjacency", () => {
    it("same terrain is always dedicated-adjacent", () => {
      expect(adj.isDedicatedAdjacency(TerrainId.Grass, TerrainId.Grass)).toBe(
        true,
      );
    });

    it("Tier 1 pairs from architecture doc", () => {
      // All 7 dedicated undirected edges
      const dedicatedPairs: [TerrainId, TerrainId][] = [
        [TerrainId.DeepWater, TerrainId.ShallowWater],
        [TerrainId.Sand, TerrainId.ShallowWater],
        [TerrainId.Sand, TerrainId.SandLight],
        [TerrainId.SandLight, TerrainId.Grass],
        [TerrainId.ShallowWater, TerrainId.Grass],
        [TerrainId.DirtLight, TerrainId.Grass],
        [TerrainId.DirtWarm, TerrainId.Grass],
      ];

      for (const [a, b] of dedicatedPairs) {
        expect(adj.isDedicatedAdjacency(a, b)).toBe(true);
        expect(adj.isDedicatedAdjacency(b, a)).toBe(true);
      }
    });

    it("non-adjacent terrains are NOT dedicated", () => {
      // DeepWater ↔ Grass has no dedicated sheet
      expect(
        adj.isDedicatedAdjacency(TerrainId.DeepWater, TerrainId.Grass),
      ).toBe(false);
      // Sand ↔ Grass has no dedicated sheet
      expect(adj.isDedicatedAdjacency(TerrainId.Sand, TerrainId.Grass)).toBe(
        false,
      );
      // DeepWater ↔ DirtWarm has no dedicated sheet
      expect(
        adj.isDedicatedAdjacency(TerrainId.DeepWater, TerrainId.DirtWarm),
      ).toBe(false);
    });
  });

  describe("isValidAdjacency", () => {
    it("same terrain is always valid", () => {
      expect(adj.isValidAdjacency(TerrainId.Sand, TerrainId.Sand)).toBe(true);
    });

    it("dedicated pairs are valid", () => {
      expect(
        adj.isValidAdjacency(TerrainId.DeepWater, TerrainId.ShallowWater),
      ).toBe(true);
    });

    it("alpha fallback pairs are valid", () => {
      // Sand ↔ Grass: no dedicated sheet, but alpha (me10 or me13) covers it
      expect(adj.isValidAdjacency(TerrainId.Sand, TerrainId.Grass)).toBe(true);
      expect(adj.isValidAdjacency(TerrainId.Grass, TerrainId.Sand)).toBe(true);
    });

    it("all terrain pairs have at least alpha adjacency", () => {
      // BlendGraph fills alpha fallbacks for all remaining pairs
      for (const a of [
        TerrainId.DeepWater,
        TerrainId.ShallowWater,
        TerrainId.Sand,
        TerrainId.SandLight,
        TerrainId.Grass,
        TerrainId.DirtLight,
        TerrainId.DirtWarm,
      ]) {
        for (const b of [
          TerrainId.DeepWater,
          TerrainId.ShallowWater,
          TerrainId.Sand,
          TerrainId.SandLight,
          TerrainId.Grass,
          TerrainId.DirtLight,
          TerrainId.DirtWarm,
        ]) {
          expect(adj.isValidAdjacency(a, b)).toBe(true);
        }
      }
    });
  });

  describe("getBridgeStep", () => {
    it("returns undefined for same terrain", () => {
      expect(adj.getBridgeStep(TerrainId.Grass, TerrainId.Grass)).toBeUndefined();
    });

    it("returns direct neighbor for Tier 1 adjacent pair", () => {
      // DeepWater → ShallowWater: directly adjacent, step = ShallowWater
      expect(adj.getBridgeStep(TerrainId.DeepWater, TerrainId.ShallowWater)).toBe(
        TerrainId.ShallowWater,
      );
    });

    it("DeepWater → Grass routes through ShallowWater", () => {
      // DeepWater has no direct Tier 1 edge to Grass
      // Path: DeepWater → ShallowWater → Grass
      expect(adj.getBridgeStep(TerrainId.DeepWater, TerrainId.Grass)).toBe(
        TerrainId.ShallowWater,
      );
    });

    it("DeepWater → DirtWarm routes through ShallowWater", () => {
      // Path: DeepWater → ShallowWater → Grass → DirtWarm
      expect(adj.getBridgeStep(TerrainId.DeepWater, TerrainId.DirtWarm)).toBe(
        TerrainId.ShallowWater,
      );
    });

    it("Sand → DirtWarm routes via SandLight or ShallowWater→Grass", () => {
      const step = adj.getBridgeStep(TerrainId.Sand, TerrainId.DirtWarm);
      expect(step).toBeDefined();
      // Sand's Tier 1 neighbors: ShallowWater, SandLight
      // Both lead to Grass which connects to DirtWarm
      expect(
        step === TerrainId.ShallowWater || step === TerrainId.SandLight,
      ).toBe(true);
    });
  });

  describe("getBridgePath", () => {
    it("returns empty for same terrain", () => {
      expect(adj.getBridgePath(TerrainId.Grass, TerrainId.Grass)).toEqual([]);
    });

    it("returns empty for directly adjacent Tier 1 pair", () => {
      expect(
        adj.getBridgePath(TerrainId.DeepWater, TerrainId.ShallowWater),
      ).toEqual([]);
    });

    it("DeepWater → Grass = [ShallowWater]", () => {
      expect(adj.getBridgePath(TerrainId.DeepWater, TerrainId.Grass)).toEqual([
        TerrainId.ShallowWater,
      ]);
    });

    it("DeepWater → DirtWarm = [ShallowWater, Grass]", () => {
      expect(
        adj.getBridgePath(TerrainId.DeepWater, TerrainId.DirtWarm),
      ).toEqual([TerrainId.ShallowWater, TerrainId.Grass]);
    });

    it("DeepWater → DirtLight = [ShallowWater, Grass]", () => {
      expect(
        adj.getBridgePath(TerrainId.DeepWater, TerrainId.DirtLight),
      ).toEqual([TerrainId.ShallowWater, TerrainId.Grass]);
    });

    it("max diameter is 3 (graph property)", () => {
      // Every pair should be reachable within 3 steps
      const terrains = [
        TerrainId.DeepWater,
        TerrainId.ShallowWater,
        TerrainId.Sand,
        TerrainId.SandLight,
        TerrainId.Grass,
        TerrainId.DirtLight,
        TerrainId.DirtWarm,
      ];
      for (const a of terrains) {
        for (const b of terrains) {
          if (a === b) continue;
          const path = adj.getBridgePath(a, b, 3);
          expect(path).toBeDefined();
        }
      }
    });

    it("respects maxSteps limit", () => {
      // DeepWater → DirtWarm needs 2 intermediates (distance 3)
      // maxSteps=1 should fail
      expect(
        adj.getBridgePath(TerrainId.DeepWater, TerrainId.DirtWarm, 1),
      ).toBeUndefined();
    });
  });
});

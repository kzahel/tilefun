import { describe, expect, it } from "vitest";
import { BlendGraph } from "./BlendGraph.js";
import { TerrainAdjacency } from "./TerrainAdjacency.js";
import { TerrainId } from "./TerrainId.js";

const graph = new BlendGraph();
const adj = new TerrainAdjacency(graph);

describe("TerrainAdjacency", () => {
  describe("hasDedicatedSheet", () => {
    it("same terrain is always dedicated", () => {
      expect(adj.hasDedicatedSheet(TerrainId.Grass, TerrainId.Grass)).toBe(true);
    });

    it("forward dedicated sheets exist", () => {
      const forwardPairs: [TerrainId, TerrainId][] = [
        [TerrainId.DeepWater, TerrainId.ShallowWater], // #16
        [TerrainId.Sand, TerrainId.ShallowWater], // #8
        [TerrainId.Sand, TerrainId.SandLight], // #9
        [TerrainId.SandLight, TerrainId.Grass], // #7
        [TerrainId.DirtLight, TerrainId.Grass], // #1
        [TerrainId.DirtWarm, TerrainId.Grass], // #2
        [TerrainId.Grass, TerrainId.DirtWarm], // #12 (reverse pair)
        [TerrainId.ShallowWater, TerrainId.Grass], // #3
        [TerrainId.Grass, TerrainId.ShallowWater], // #15 (reverse pair)
      ];

      for (const [a, b] of forwardPairs) {
        expect(adj.hasDedicatedSheet(a, b)).toBe(true);
      }
    });

    it("reverse directions without dedicated sheets are NOT dedicated", () => {
      expect(adj.hasDedicatedSheet(TerrainId.ShallowWater, TerrainId.DeepWater)).toBe(false);
      expect(adj.hasDedicatedSheet(TerrainId.ShallowWater, TerrainId.Sand)).toBe(false);
      expect(adj.hasDedicatedSheet(TerrainId.SandLight, TerrainId.Sand)).toBe(false);
      expect(adj.hasDedicatedSheet(TerrainId.Grass, TerrainId.SandLight)).toBe(false);
      expect(adj.hasDedicatedSheet(TerrainId.Grass, TerrainId.DirtLight)).toBe(false);
    });

    it("non-adjacent terrains are NOT dedicated", () => {
      expect(adj.hasDedicatedSheet(TerrainId.DeepWater, TerrainId.Grass)).toBe(false);
      expect(adj.hasDedicatedSheet(TerrainId.Sand, TerrainId.Grass)).toBe(false);
    });
  });

  describe("isValidAdjacency", () => {
    it("same terrain is always valid", () => {
      expect(adj.isValidAdjacency(TerrainId.Sand, TerrainId.Sand)).toBe(true);
    });

    it("dedicated pairs are valid (including reverse direction)", () => {
      expect(adj.isValidAdjacency(TerrainId.DeepWater, TerrainId.ShallowWater)).toBe(true);
      // Reverse direction valid because dedicated sheet exists for forward
      expect(adj.isValidAdjacency(TerrainId.ShallowWater, TerrainId.DeepWater)).toBe(true);
    });

    it("alpha fallback pairs are valid", () => {
      // Sand ↔ Grass: no dedicated sheet, but alpha (me10 or me13) covers it
      expect(adj.isValidAdjacency(TerrainId.Sand, TerrainId.Grass)).toBe(true);
      expect(adj.isValidAdjacency(TerrainId.Grass, TerrainId.Sand)).toBe(true);
    });

    it("dirt↔non-grass pairs have no adjacency (no alpha or dedicated sheet)", () => {
      // Dirt has no alpha sheet, so only dirt↔grass has adjacency
      for (const dirt of [TerrainId.DirtLight, TerrainId.DirtWarm]) {
        for (const other of [TerrainId.Sand, TerrainId.SandLight, TerrainId.DeepWater]) {
          expect(adj.isValidAdjacency(dirt, other)).toBe(false);
        }
      }
    });

    it("non-dirt pairs with dedicated/alpha still have adjacency", () => {
      for (const [a, b] of [
        [TerrainId.Grass, TerrainId.Sand],
        [TerrainId.Sand, TerrainId.SandLight],
        [TerrainId.DeepWater, TerrainId.ShallowWater],
        [TerrainId.DirtLight, TerrainId.Grass],
        [TerrainId.DirtWarm, TerrainId.Grass],
      ] as [TerrainId, TerrainId][]) {
        expect(adj.isValidAdjacency(a, b)).toBe(true);
      }
    });

    it("water↔non-adjacent terrains are NOT valid (no alpha, no dedicated pair)", () => {
      // DeepWater has no alpha and no dedicated pair with Grass
      expect(adj.isValidAdjacency(TerrainId.DeepWater, TerrainId.Grass)).toBe(false);
      expect(adj.isValidAdjacency(TerrainId.DeepWater, TerrainId.Sand)).toBe(false);
    });
  });

  describe("getBridgeStep", () => {
    it("returns undefined for same terrain", () => {
      expect(adj.getBridgeStep(TerrainId.Grass, TerrainId.Grass)).toBeUndefined();
    });

    it("returns direct neighbor for valid-adjacent pair", () => {
      expect(adj.getBridgeStep(TerrainId.Grass, TerrainId.Sand)).toBe(TerrainId.Sand);
    });

    it("DirtWarm → Sand routes through Grass", () => {
      // DirtWarm↔Sand has no blend (no alpha for dirt), must bridge via Grass
      expect(adj.getBridgeStep(TerrainId.DirtWarm, TerrainId.Sand)).toBe(TerrainId.Grass);
    });

    it("DirtLight → DeepWater routes through Grass then ShallowWater", () => {
      // DirtLight→Grass (dedicated), Grass→ShallowWater (dedicated), ShallowWater↔DeepWater
      expect(adj.getBridgeStep(TerrainId.DirtLight, TerrainId.DeepWater)).toBe(TerrainId.Grass);
    });
  });

  describe("getBridgePath", () => {
    it("returns empty for same terrain", () => {
      expect(adj.getBridgePath(TerrainId.Grass, TerrainId.Grass)).toEqual([]);
    });

    it("returns empty for valid-adjacent pair (dedicated or alpha)", () => {
      // DeepWater↔ShallowWater: dedicated pair covers both directions
      expect(adj.getBridgePath(TerrainId.DeepWater, TerrainId.ShallowWater)).toEqual([]);
      // Sand↔Grass: alpha covers both directions
      expect(adj.getBridgePath(TerrainId.Sand, TerrainId.Grass)).toEqual([]);
    });

    it("DeepWater → Grass bridges through ShallowWater", () => {
      // DeepWater has no direct adjacency with Grass (no alpha, no dedicated)
      const path = adj.getBridgePath(TerrainId.DeepWater, TerrainId.Grass);
      expect(path).toBeDefined();
      expect(path).toContain(TerrainId.ShallowWater);
    });

    it("DirtWarm → Sand bridges through Grass", () => {
      // DirtWarm has no blend toward Sand (no alpha for dirt)
      expect(adj.getBridgePath(TerrainId.DirtWarm, TerrainId.Sand)).toEqual([TerrainId.Grass]);
    });

    it("DirtLight → DirtWarm bridges through Grass", () => {
      expect(adj.getBridgePath(TerrainId.DirtLight, TerrainId.DirtWarm)).toEqual([TerrainId.Grass]);
    });

    it("all pairs reachable within 3 steps", () => {
      // Water terrains may need extra step: DeepWater→ShallowWater→Grass→...
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
          expect(path, `${TerrainId[a]} → ${TerrainId[b]}`).toBeDefined();
        }
      }
    });
  });
});

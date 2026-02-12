import { describe, expect, it } from "vitest";
import { BlendGraph } from "./BlendGraph.js";
import { ALL_TERRAIN_IDS, TerrainId } from "./TerrainId.js";

describe("BlendGraph", () => {
  const graph = new BlendGraph();

  describe("exhaustive coverage", () => {
    it("returns undefined for same-terrain pairs", () => {
      for (const t of ALL_TERRAIN_IDS) {
        expect(graph.getBlend(t, t)).toBeUndefined();
      }
    });

    it("returns a valid BlendEntry for all pairs that have blends", () => {
      // Dirt terrains have no alpha fallback (no dirt alpha sheet exists),
      // so pairs like DirtLight↔Sand have no blend entry.
      for (const my of ALL_TERRAIN_IDS) {
        for (const neighbor of ALL_TERRAIN_IDS) {
          if (my === neighbor) continue;
          const entry = graph.getBlend(my, neighbor);
          if (entry) {
            expect(entry.sheetIndex).toBeGreaterThanOrEqual(0);
            expect(entry.sheetKey).toBeTruthy();
            expect(entry.assetPath).toMatch(/\.png$/);
          }
        }
      }
    });

    it("returns undefined for dirt↔non-grass pairs (no dedicated or alpha)", () => {
      for (const dirt of [TerrainId.DirtLight, TerrainId.DirtWarm]) {
        for (const other of [TerrainId.Sand, TerrainId.SandLight, TerrainId.DeepWater]) {
          expect(graph.getBlend(dirt, other)).toBeUndefined();
        }
      }
    });
  });

  describe("dedicated pair sheets", () => {
    it("uses #16 for DeepWater↔ShallowWater (direct)", () => {
      const entry = graph.getBlend(TerrainId.DeepWater, TerrainId.ShallowWater);
      expect(entry).toBeDefined();
      expect(entry?.sheetKey).toBe("me16");
      expect(entry?.inverted).toBe(false);
      expect(entry?.isAlpha).toBe(false);
    });

    it("uses #16 inverted for ShallowWater→DeepWater", () => {
      const entry = graph.getBlend(TerrainId.ShallowWater, TerrainId.DeepWater);
      expect(entry).toBeDefined();
      expect(entry?.sheetKey).toBe("me16");
      expect(entry?.inverted).toBe(true);
    });

    it("uses #8 for Sand→ShallowWater (direct)", () => {
      const entry = graph.getBlend(TerrainId.Sand, TerrainId.ShallowWater);
      expect(entry?.sheetKey).toBe("me08");
      expect(entry?.inverted).toBe(false);
    });

    it("uses #8 inverted for ShallowWater→Sand", () => {
      const entry = graph.getBlend(TerrainId.ShallowWater, TerrainId.Sand);
      expect(entry?.sheetKey).toBe("me08");
      expect(entry?.inverted).toBe(true);
    });

    it("uses #15 for Grass→ShallowWater (direct, reverse pair)", () => {
      const entry = graph.getBlend(TerrainId.Grass, TerrainId.ShallowWater);
      expect(entry?.sheetKey).toBe("me15");
      expect(entry?.inverted).toBe(false);
    });

    it("uses #3 for ShallowWater→Grass (direct, reverse pair)", () => {
      const entry = graph.getBlend(TerrainId.ShallowWater, TerrainId.Grass);
      expect(entry?.sheetKey).toBe("me03");
      expect(entry?.inverted).toBe(false);
    });

    it("uses #12 for Grass→DirtWarm (direct, reverse pair)", () => {
      const entry = graph.getBlend(TerrainId.Grass, TerrainId.DirtWarm);
      expect(entry?.sheetKey).toBe("me12");
      expect(entry?.inverted).toBe(false);
    });

    it("uses #2 for DirtWarm→Grass (direct)", () => {
      const entry = graph.getBlend(TerrainId.DirtWarm, TerrainId.Grass);
      expect(entry?.sheetKey).toBe("me02");
      expect(entry?.inverted).toBe(false);
    });

    it("uses #9 for Sand↔SandLight", () => {
      expect(graph.getBlend(TerrainId.Sand, TerrainId.SandLight)?.sheetKey).toBe("me09");
      expect(graph.getBlend(TerrainId.SandLight, TerrainId.Sand)?.sheetKey).toBe("me09");
    });

    it("uses #7 for SandLight↔Grass", () => {
      expect(graph.getBlend(TerrainId.SandLight, TerrainId.Grass)?.sheetKey).toBe("me07");
      expect(graph.getBlend(TerrainId.Grass, TerrainId.SandLight)?.sheetKey).toBe("me07");
    });

    it("uses #1 for DirtLight↔Grass", () => {
      expect(graph.getBlend(TerrainId.DirtLight, TerrainId.Grass)?.sheetKey).toBe("me01");
      expect(graph.getBlend(TerrainId.Grass, TerrainId.DirtLight)?.sheetKey).toBe("me01");
    });
  });

  describe("alpha fallbacks", () => {
    it("uses alpha for Sand→Grass (no dedicated pair)", () => {
      const entry = graph.getBlend(TerrainId.Sand, TerrainId.Grass);
      expect(entry?.isAlpha).toBe(true);
      expect(entry?.sheetKey).toBe("me10"); // sand alpha
    });

    it("uses alpha for Grass→Sand (no dedicated pair)", () => {
      const entry = graph.getBlend(TerrainId.Grass, TerrainId.Sand);
      expect(entry?.isAlpha).toBe(true);
      expect(entry?.sheetKey).toBe("me13"); // grass alpha
    });

    it("uses alpha for DeepWater→Grass (no dedicated pair)", () => {
      const entry = graph.getBlend(TerrainId.DeepWater, TerrainId.Grass);
      expect(entry?.isAlpha).toBe(true);
    });

    it("returns undefined for DirtLight→DirtWarm (no dedicated pair, no dirt alpha)", () => {
      expect(graph.getBlend(TerrainId.DirtLight, TerrainId.DirtWarm)).toBeUndefined();
    });

    it("all non-dedicated pairs have isAlpha=true", () => {
      const dedicatedKeys = new Set<string>();
      // Known dedicated pairs (both directions)
      const pairs: [TerrainId, TerrainId][] = [
        [TerrainId.DeepWater, TerrainId.ShallowWater],
        [TerrainId.Sand, TerrainId.ShallowWater],
        [TerrainId.Sand, TerrainId.SandLight],
        [TerrainId.SandLight, TerrainId.Grass],
        [TerrainId.DirtLight, TerrainId.Grass],
        [TerrainId.DirtWarm, TerrainId.Grass],
        [TerrainId.ShallowWater, TerrainId.Grass],
      ];
      for (const [a, b] of pairs) {
        dedicatedKeys.add(`${a},${b}`);
        dedicatedKeys.add(`${b},${a}`);
      }

      for (const my of ALL_TERRAIN_IDS) {
        for (const neighbor of ALL_TERRAIN_IDS) {
          if (my === neighbor) continue;
          const entry = graph.getBlend(my, neighbor);
          if (entry && !dedicatedKeys.has(`${my},${neighbor}`)) {
            expect(
              entry.isAlpha,
              `(${TerrainId[my]}, ${TerrainId[neighbor]}) should be alpha`,
            ).toBe(true);
          }
        }
      }
    });
  });

  describe("base fills", () => {
    it("provides a base fill for every terrain", () => {
      for (const t of ALL_TERRAIN_IDS) {
        const fill = graph.getBaseFill(t);
        expect(fill, `Missing base fill for ${TerrainId[t]}`).toBeDefined();
        if (fill) {
          expect(fill.col).toBe(1);
          expect(fill.row).toBe(0);
          expect(fill.sheetIndex).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  describe("alpha overlays", () => {
    it("provides alpha for terrains that have alpha sheets", () => {
      // Grass, Sand, SandLight, water terrains have alpha
      for (const t of [
        TerrainId.Grass,
        TerrainId.Sand,
        TerrainId.SandLight,
        TerrainId.ShallowWater,
        TerrainId.DeepWater,
      ]) {
        const alpha = graph.getAlpha(t);
        expect(alpha, `Missing alpha for ${TerrainId[t]}`).toBeDefined();
        if (alpha) {
          expect(alpha.isAlpha).toBe(true);
        }
      }
    });

    it("has no alpha for dirt terrains (no dirt alpha sheet exists)", () => {
      expect(graph.getAlpha(TerrainId.DirtLight)).toBeUndefined();
      expect(graph.getAlpha(TerrainId.DirtWarm)).toBeUndefined();
    });

    it("uses grass alpha (#13) for grass", () => {
      expect(graph.getAlpha(TerrainId.Grass)?.sheetKey).toBe("me13");
    });

    it("uses sand alpha (#10) for sand-family terrains", () => {
      expect(graph.getAlpha(TerrainId.Sand)?.sheetKey).toBe("me10");
      expect(graph.getAlpha(TerrainId.SandLight)?.sheetKey).toBe("me10");
    });
  });

  describe("sheet loading", () => {
    it("registers 11 unique ME sheets", () => {
      expect(graph.allSheets.length).toBe(11);
    });

    it("all sheet paths point to ME autotile PNGs", () => {
      for (const sheet of graph.allSheets) {
        expect(sheet.assetPath).toMatch(/^assets\/tilesets\/me-autotile-\d{2}\.png$/);
      }
    });
  });
});

import { describe, expect, it } from "vitest";
import { TerrainId } from "../../autotile/TerrainId.js";
import { CHUNK_SIZE } from "../../config/constants.js";
import { Chunk } from "../../world/Chunk.js";
import { createDescriptor } from "../GenerationDescriptor.js";
import { createGenerator } from "../Generator.js";
import { plannedElevation, QUERY_LIMITS, queryRegion } from "./RegionalPlanner.js";
import { regionalTerrainForElevation } from "./RegionalTerrain.js";
import { regionalWorld } from "./WorldDescriptor.js";

describe("Regional realization", () => {
  for (const [cx, cy] of [
    [-1, -1],
    [18, 32],
    [100, -81],
  ] as const)
    it(`shares borders at ${cx},${cy}`, () => {
      const generator = createGenerator(createDescriptor("regional", 2026));
      const a = new Chunk();
      const east = new Chunk();
      const south = new Chunk();
      generator.terrain.generate(a, cx, cy);
      generator.terrain.generate(east, cx + 1, cy);
      generator.terrain.generate(south, cx, cy + 1);
      for (let i = 0; i < Chunk.SUBGRID_SIZE; i++) {
        expect(a.getSubgrid(Chunk.SUBGRID_SIZE - 1, i)).toBe(east.getSubgrid(0, i));
        expect(a.getSubgrid(i, Chunk.SUBGRID_SIZE - 1)).toBe(south.getSubgrid(i, 0));
      }
      expect(generator.placements(cx, cy, new Set()).placements).toEqual([]);
    });
  it("uses the overview water/shore thresholds and supported terrain chain", () => {
    const world = regionalWorld(2026);
    const generator = createGenerator(createDescriptor("regional", world.seed));
    for (const [cx, cy] of [
      [-10, -10],
      [50, 20],
      [0, 0],
    ] as const) {
      const chunk = new Chunk();
      generator.terrain.generate(chunk, cx, cy);
      for (let ly = 0; ly < CHUNK_SIZE; ly++)
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const elevation = plannedElevation(
            world,
            cx * CHUNK_SIZE + lx + 0.5,
            cy * CHUNK_SIZE + ly + 0.5,
          );
          if (!chunk.getRoad(lx, ly))
            expect(chunk.getSubgrid(lx * 2 + 1, ly * 2 + 1)).toBe(
              regionalTerrainForElevation(elevation),
            );
          else expect(chunk.getCollision(lx, ly)).toBe(0);
        }
    }
    expect(regionalTerrainForElevation(-0.001)).toBe(TerrainId.ShallowWater);
    expect(regionalTerrainForElevation(0)).toBe(TerrainId.Sand);
    expect(
      queryRegion(world, {
        bounds: { minX: -100, minY: -100, maxX: 100, maxY: 100 },
        detail: "overview",
        sampleStep: 4,
        limits: QUERY_LIMITS,
      }).stats.detailedChunks,
    ).toBe(0);
  });
});

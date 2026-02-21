import { describe, expect, it } from "vitest";
import { BlendGraph } from "../autotile/BlendGraph.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import { World } from "./World.js";

describe("World", () => {
  it("computeAutotile respects max chunk budget", () => {
    const world = new World(new FlatStrategy());
    const graph = new BlendGraph();

    world.updateLoadedChunks({ minCx: 0, minCy: 0, maxCx: 0, maxCy: 0 }, 3);
    expect(world.chunks.loadedCount).toBe(3);

    world.computeAutotile(graph, 1);
    const afterFirst = Array.from(world.chunks.entries()).filter(
      ([, c]) => c.autotileComputed,
    ).length;
    expect(afterFirst).toBe(1);

    world.computeAutotile(graph, 1);
    const afterSecond = Array.from(world.chunks.entries()).filter(
      ([, c]) => c.autotileComputed,
    ).length;
    expect(afterSecond).toBe(2);
  });
});

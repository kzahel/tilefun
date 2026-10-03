import { expect, it, vi } from "vitest";
import { DenseDistrictSource } from "../generation/regional/DenseDistrictPlanner.js";
import { Chunk } from "../world/Chunk.js";
import { archivedCityScene, createPreviewGenerator } from "./CityReviewArchive.js";

it("replays archived scenes and terrain without executing the evolving planner", () => {
  const planner = vi.spyOn(DenseDistrictSource.prototype, "owner").mockImplementation(() => {
    throw new Error("Current planner changed");
  });
  try {
    const scene = archivedCityScene("district-v1-neighborhood");
    expect(scene.props.length).toBeGreaterThan(10);
    const preview = createPreviewGenerator(scene.generation);
    const a = new Chunk(),
      b = new Chunk();
    preview.terrain.generate(a, 18, 32);
    preview.terrain.generate(b, 18, 32);
    expect(a.subgrid).toEqual(b.subgrid);
    expect(a.roadGrid).toEqual(b.roadGrid);
    expect(planner).not.toHaveBeenCalled();
    scene.props.length = 0;
    expect(archivedCityScene("district-v1-neighborhood").props.length).toBeGreaterThan(10);
    expect(() => preview.terrain.generate(new Chunk(), 1000, 1000)).toThrow(/Outside the archived/);
    expect(() => createPreviewGenerator({ ...scene.generation, seed: 42 })).toThrow(/retired/);
  } finally {
    planner.mockRestore();
  }
});

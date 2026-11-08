import { expect, it, vi } from "vitest";
import { Chunk } from "../world/Chunk.js";
import { TerrainResidency } from "./TerrainResidency.js";

const chunks = new Map<string, Chunk>();
for (let cy = -2; cy <= 2; cy++)
  for (let cx = -2; cx <= 3; cx++) chunks.set(`${cx},${cy}`, new Chunk());
const world = {
  getChunkIfLoaded: (cx: number, cy: number) => chunks.get(`${cx},${cy}`),
  getRoadAt: () => 0,
};
const range = (cx: number, cy: number) => ({ minCx: cx, minCy: cy, maxCx: cx, maxCy: cy });

it("queues a chunk two views share once, ranked and focused by the view that shows it", () => {
  const residency = new TerrainResidency();
  const surfaces = { isReady: () => false, hasImage: () => false, drop: vi.fn() };
  const left = { view: { x: 128, y: 128 }, visible: range(0, 0) };
  const right = { view: { x: 384, y: 200 }, visible: range(1, 0) };
  const jobs = residency.scan([left, right], world, surfaces, 0);
  const keys = jobs.map((job) => job.key);
  expect(new Set(keys).size).toBe(keys.length);
  expect(keys.slice(0, 2)).toEqual(["0,0", "1,0"]);
  // Halo in the left view, on screen in the right: the right view's ranking and row.
  expect(jobs.find((job) => job.key === "1,0")).toMatchObject({ priority: 0, focalY: 200 });
  expect(jobs.find((job) => job.key === "-1,0")).toMatchObject({ priority: 2, focalY: 128 });
  expect(residency.resident.size).toBe(12); // x -1..2, y -1..1
  residency.release();
  expect(residency.jobs).toHaveLength(0);
  // Without the right view, chunks only it kept are dropped; shared ones stay.
  residency.scan([left], world, surfaces, 1);
  const dropped = surfaces.drop.mock.calls.map(([, key]) => key).sort();
  expect(dropped).toEqual(["2,-1", "2,0", "2,1"]);
  expect(residency.resident.size).toBe(9);
});

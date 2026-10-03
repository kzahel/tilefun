import { expect, it } from "vitest";
import { Chunk } from "../world/Chunk.js";
import { TerrainFrame } from "./TerrainFrame.js";
import type { TerrainResourceId } from "./TerrainPresentation.js";

it("places opaque resources without graphics, reuses records, and culls before lookup", () => {
  const frame = new TerrainFrame(),
    other = new TerrainFrame(),
    chunk = new Chunk();
  const calls: number[] = [];
  const world = { getChunkIfLoaded: () => chunk };
  let id = 7 as TerrainResourceId;
  const resources = {
    groundResourceId(_chunk: Chunk, cx: number) {
      calls.push(cx);
      return id;
    },
  };
  const view = { x: 128, y: 128, zoom: 1 / 3, viewportWidth: 256, viewportHeight: 256 };
  const visible = { minCx: -2, maxCx: 2, minCy: 0, maxCy: 0 };
  const draws = frame.collect(view, world, resources, visible);
  expect(calls).toEqual([-1, 0, 1]); // touching edges retained, far chunks culled
  expect(draws.map((d) => ({ ...d }))).toEqual(
    [-256, 0, 256].map((x) => ({ resource: 7, x, y: 0, width: 257, height: 257 })),
  );
  const center = draws[1];
  const snapshot = structuredClone(draws);
  id = 8 as TerrainResourceId;
  view.x += 1;
  expect(frame.collect(view, world, resources, visible, { overscanPixels: 0 })[1]).toBe(center);
  // Moving past the left edge culls that chunk; pool slots follow draw order.
  expect(center).toMatchObject({ resource: 8, x: 255, width: 256 });
  expect(snapshot[1]?.resource).toBe(7);
  expect(other.collect(view, world, resources, visible)[1]).not.toBe(center);
  frame.clear();
  expect(draws).toHaveLength(0);
  expect(frame.collect(view, world, resources, visible)[1]).not.toBe(center);
});

it("forwards completed-only policy and bounds record retention for oversized views", () => {
  const frame = new TerrainFrame(),
    chunk = new Chunk();
  const world = { getChunkIfLoaded: () => chunk };
  const resources = {
    groundResourceId(_chunk: Chunk, _x: number, _y: number, readyOnly: boolean) {
      return readyOnly ? null : (1 as TerrainResourceId);
    },
  };
  const view = { x: 0, y: 0, zoom: 1 / 3, viewportWidth: 2000000, viewportHeight: 256 };
  const range = { minCx: 0, maxCx: 3000, minCy: 0, maxCy: 0 };
  expect(frame.collect(view, world, resources, range, { readyOnly: true })).toHaveLength(0);
  const first = [...frame.collect(view, world, resources, range)];
  const next = frame.collect(view, world, resources, range);
  expect(next).toHaveLength(3001);
  expect(next[2047]).toBe(first[2047]);
  expect(next[2048]).not.toBe(first[2048]);
});

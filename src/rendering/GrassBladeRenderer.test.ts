import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { TerrainId } from "../autotile/TerrainId.js";
import { Chunk } from "../world/Chunk.js";
import { collectGrassBladeItems, GrassFrameBuffer } from "./GrassBladeRenderer.js";

function chunk(terrain = TerrainId.Grass): Chunk {
  const result = new Chunk();
  result.blendBase.fill(terrain);
  result.autotileComputed = true;
  return result;
}

function collect(value: Chunk | undefined, cx = 0, cy = 0, nowSec = 0) {
  return collectGrassBladeItems(
    { getChunkIfLoaded: () => value },
    [],
    { minCx: cx, maxCx: cx, minCy: cy, maxCy: cy },
    { minWx: cx * 256, maxWx: (cx + 1) * 256, minWy: cy * 256, maxWy: (cy + 1) * 256 },
    nowSec,
  );
}

describe("grass cache identity and lifetime", () => {
  it("keeps equal-revision chunks from different worlds independent", () => {
    const grass = chunk();
    const water = chunk(TerrainId.ShallowWater);
    const original = collect(grass);
    expect(original).toHaveLength(338);
    expect(collect(water)).toEqual([]);
    expect(collect(grass)).toEqual(original);
  });

  it("uses replacement content after unloading and revisiting a coordinate", () => {
    expect(collect(chunk())).toHaveLength(338);
    expect(collect(undefined)).toEqual([]);
    expect(collect(chunk(TerrainId.ShallowWater))).toEqual([]);
    expect(collect(chunk())).toHaveLength(338);
  });

  it("reuses unchanged placement but rebuilds after a content revision", () => {
    const value = chunk();
    const readRoad = vi.spyOn(value, "getRoad");
    const original = collect(value);
    readRoad.mockClear();
    const animated = collect(value, 0, 0, 1);
    expect(readRoad).not.toHaveBeenCalled();
    expect(animated.map(({ wx, wy, variant }) => ({ wx, wy, variant }))).toEqual(
      original.map(({ wx, wy, variant }) => ({ wx, wy, variant })),
    );
    expect(animated.some((item, i) => item.angle !== original[i]?.angle)).toBe(true);

    value.roadGrid.fill(1);
    value.revision++;
    expect(collect(value)).toEqual([]);
    expect(readRoad).toHaveBeenCalled();
    value.roadGrid.fill(0);
    value.revision++;
    expect(collect(value)).toEqual(original);
  });

  it("waits for autotiling before collecting a replacement", () => {
    const value = chunk();
    value.autotileComputed = false;
    expect(collect(value)).toEqual([]);
    value.autotileComputed = true;
    expect(collect(value)).toHaveLength(338);
  });

  it("rebuilds world-space placements if a chunk object is used at another coordinate", () => {
    const value = chunk();
    const original = collect(value);
    const moved = collect(value, -3, 2);
    expect(moved.length).toBeGreaterThan(0);
    expect(moved).toEqual(collect(chunk(), -3, 2));
    expect(collect(value)).toEqual(original);
  });

  it("preserves the existing generated placement and iteration order", () => {
    const placements = collect(chunk()).map(({ wx, wy, variant }) => ({ wx, wy, variant }));
    expect(createHash("sha256").update(JSON.stringify(placements)).digest("hex")).toBe(
      "ba2fa725a0b841c6f36f7fde592bab10ef9fd430ad3b131eb7b4d700d02dd6e6",
    );
  });
});

describe("reusable grass frames", () => {
  it("matches fresh collection through movement, fewer entities, culling and chunk edits", () => {
    const value = chunk();
    const world = { getChunkIfLoaded: () => value };
    const range = { minCx: 0, maxCx: 0, minCy: 0, maxCy: 0 };
    const viewport = { minWx: 0, maxWx: 256, minWy: 0, maxWy: 256 };
    const scratch = new GrassFrameBuffer();
    const output: ReturnType<typeof collectGrassBladeItems> = [];
    const entities = [{ position: { wx: 80, wy: 64 } }, { position: { wx: 32, wy: 24 } }];
    for (let frame = 0; frame < 5; frame++) {
      if (frame === 1) entities.pop();
      if (frame === 2) entities.length = 0;
      if (frame === 3) viewport.minWx = 128;
      if (frame === 4) {
        value.roadGrid.fill(1);
        value.revision++;
      }
      output.length = 0;
      expect(
        collectGrassBladeItems(world, entities, range, viewport, frame, scratch, output),
      ).toEqual(collectGrassBladeItems(world, entities, range, viewport, frame));
    }
  });

  it("reuses warm records and buffers without sharing them between consumers", () => {
    const value = chunk();
    const world = { getChunkIfLoaded: () => value };
    const range = { minCx: 0, maxCx: 0, minCy: 0, maxCy: 0 };
    const viewport = { minWx: 0, maxWx: 256, minWy: 0, maxWy: 256 };
    const entities = [{ position: { wx: 64, wy: 64 } }];
    const scratch = new GrassFrameBuffer();
    const first = collectGrassBladeItems(world, entities, range, viewport, 0, scratch);
    const other = collectGrassBladeItems(
      world,
      entities,
      range,
      viewport,
      0,
      new GrassFrameBuffer(),
    );
    const snapshot = structuredClone(other);
    const buffers = [scratch.x, scratch.y];
    const diagnostics = scratch.getDiagnostics();
    const second = collectGrassBladeItems(world, entities, range, viewport, 1, scratch);
    expect(second.every((item, i) => item === first[i])).toBe(true);
    expect(second[0]).not.toBe(other[0]);
    expect(other).toEqual(snapshot);
    expect(scratch.x).toBe(buffers[0]);
    expect(scratch.y).toBe(buffers[1]);
    expect(scratch.getDiagnostics()).toEqual(diagnostics);
  });

  it("reuses every record in a warm overview without changing values or order", () => {
    const scratch = new GrassFrameBuffer();
    scratch.begin([]);
    const first = Array.from({ length: 40000 }, (_, i) => scratch.next(i, i % 1024, i % 4, 0));
    scratch.end();
    const before = scratch.getDiagnostics();
    scratch.begin([]);
    for (let i = 0; i < first.length; i++) {
      const item = scratch.next(i + 1, i % 512, (i + 1) % 4, 0.125);
      expect(item).toBe(first[i]);
      expect(item).toEqual({
        kind: "grass",
        wx: i + 1,
        wy: i % 512,
        sortKey: i % 512,
        variant: (i + 1) % 4,
        angle: 0.125,
      });
    }
    scratch.end();
    expect(scratch.getDiagnostics()).toEqual(before);
  });

  it("caps retained storage without dropping oversized output, then shrinks and clears", () => {
    const scratch = new GrassFrameBuffer();
    scratch.begin(Array.from({ length: 1025 }, () => ({ position: { wx: 1, wy: 2 } })));
    const output = Array.from({ length: 66000 }, (_, i) => scratch.next(i, i, i % 4, 0));
    scratch.end();
    expect(output).toHaveLength(66000);
    expect(new Set(output).size).toBe(66000);
    expect(scratch.getDiagnostics().retainedItems).toBe(65536);
    expect(scratch.getDiagnostics().positionCapacity).toBe(0);
    scratch.begin(Array.from({ length: 512 }, () => ({ position: { wx: 1, wy: 2 } })));
    scratch.end();
    for (let i = 0; i < 60; i++) {
      scratch.begin([]);
      scratch.next(1, 2, 0, 0);
      scratch.end();
    }
    expect(scratch.getDiagnostics().retainedItems).toBe(256);
    expect(scratch.getDiagnostics().positionCapacity).toBe(32);
    scratch.clear();
    expect(scratch.getDiagnostics().retainedItems).toBe(0);
    expect(scratch.getDiagnostics().positionCapacity).toBe(0);
    expect(scratch.getDiagnostics().activeItems).toBe(0);
  });
});

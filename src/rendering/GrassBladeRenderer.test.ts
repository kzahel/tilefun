import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { TerrainId } from "../autotile/TerrainId.js";
import { Chunk } from "../world/Chunk.js";
import { collectGrassBladeItems } from "./GrassBladeRenderer.js";

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

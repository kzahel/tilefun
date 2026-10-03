import { describe, expect, it } from "vitest";
import { ELEVATION_PX } from "../config/constants.js";
import { Chunk } from "../world/Chunk.js";
import { ElevationDescriptorCache } from "./ElevationDescriptorCache.js";
import type { TerrainResourceId } from "./TerrainPresentation.js";

const range = { minCx: -1, maxCx: -1, minCy: 2, maxCy: 2 };
const firstResource = 11 as TerrainResourceId;
const secondResource = 12 as TerrainResourceId;
function fixture() {
  let chunk = new Chunk();
  chunk.setHeight(15, 3, 2);
  let resource: TerrainResourceId | null = firstResource;
  const cache = new ElevationDescriptorCache();
  const world = { getChunkIfLoaded: () => chunk };
  const resources = { resourceId: () => resource };
  return {
    cache,
    chunk,
    world,
    resources,
    replace(value: Chunk) {
      chunk = value;
    },
    bind(value: TerrainResourceId | null) {
      resource = value;
    },
    collect: () => cache.collect(world, range, resources),
  };
}

describe("static elevation presentation", () => {
  it("reuses immutable world geometry and preserves surface/cliff order without graphics objects", () => {
    const f = fixture();
    const items = f.collect();
    expect(items).toEqual([
      {
        kind: "elevation",
        phase: "surface",
        terrainResource: firstResource,
        wx: -16,
        wy: 560,
        srcX: 240,
        srcY: 48,
        height: 2,
        sortKey: 560 + 2 * ELEVATION_PX - 0.5,
      },
      {
        kind: "elevation",
        phase: "cliff",
        terrainResource: firstResource,
        wx: -16,
        wy: 560,
        srcX: 240,
        srcY: 48,
        height: 2,
        sortKey: 576,
      },
    ]);
    const again = f.collect();
    expect(again).not.toBe(items); // Consumers own the list, not the shared records.
    expect(again[0]).toBe(items[0]);
    again.reverse();
    expect(f.collect()).toEqual(items);
    expect(f.cache.getDiagnostics()).toEqual({
      layoutBuilds: 1,
      createdDescriptors: 2,
      createdItems: 2,
    });
  });

  it("rebinds replacement imagery without rebuilding geometry or mutating old frames", () => {
    const f = fixture();
    const original = f.collect();
    f.bind(null);
    expect(f.collect()).toEqual([]);
    f.bind(secondResource);
    const replacement = f.collect();
    expect(replacement[0]?.terrainResource).toBe(secondResource);
    expect(original[0]?.terrainResource).toBe(firstResource);
    expect(replacement[0]).not.toBe(original[0]);
    expect(f.cache.getDiagnostics()).toEqual({
      layoutBuilds: 1,
      createdDescriptors: 2,
      createdItems: 4,
    });
  });

  it("invalidates local and replicated edits, equal-version replacements and coordinate changes", () => {
    const f = fixture();
    const original = f.collect();
    f.chunk.setHeight(15, 3, 3);
    f.chunk.invalidateVisuals();
    expect(f.collect()[0]?.height).toBe(3);
    expect(original[0]?.height).toBe(2);
    f.chunk.setHeight(15, 3, 0);
    f.chunk.revision++;
    expect(f.collect()).toEqual([]);
    const replacement = new Chunk();
    replacement.revision = f.chunk.revision;
    replacement.visualRevision = f.chunk.visualRevision;
    replacement.setHeight(15, 3, 1);
    f.replace(replacement);
    expect(f.collect()[0]?.height).toBe(1);
    const moved = f.cache.collect(f.world, { minCx: 0, maxCx: 0, minCy: 0, maxCy: 0 }, f.resources);
    expect(moved[0]).toMatchObject({ wx: 240, wy: 48 });
    f.cache.clear();
    expect(f.collect()[0]).toMatchObject({ wx: -16, wy: 560 });
    expect(f.cache.getDiagnostics().layoutBuilds).toBe(6);
  });

  it("caches empty chunks and skips missing data or unavailable terrain resources", () => {
    const f = fixture();
    f.replace(new Chunk());
    expect(f.collect()).toEqual([]);
    expect(f.collect()).toEqual([]);
    expect(f.cache.getDiagnostics().layoutBuilds).toBe(1);
    expect(f.cache.collect({ getChunkIfLoaded: () => undefined }, range, f.resources)).toEqual([]);
    f.bind(null);
    f.replace(new Chunk());
    expect(f.collect()).toEqual([]);
    expect(f.cache.getDiagnostics().layoutBuilds).toBe(1);
  });
});

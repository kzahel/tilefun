import { describe, expect, it } from "vitest";
import { CHUNK_SIZE, TILE_SIZE } from "../../config/constants.js";
import { chunksInReach, terrainStale } from "./FirstPersonView.js";

describe("first-person chunk residency", () => {
  it("rebuilds ground for a replaced chunk object even with the same revisions", () => {
    // A freshly loaded world's chunk at the same coordinates usually arrives with the
    // same revision pair, so the object identity must be part of the cache key.
    const first = { revision: 3, visualRevision: 1 };
    const cached = { chunk: first, key: "3:1" };
    expect(terrainStale(cached, first)).toBe(false);
    expect(terrainStale(cached, { revision: 3, visualRevision: 1 })).toBe(true);
    first.visualRevision = 2;
    expect(terrainStale(cached, first)).toBe(true);
    expect(terrainStale(undefined, first)).toBe(true);
  });

  it("lists chunks inside the reach circle, nearest first", () => {
    const size = CHUNK_SIZE * TILE_SIZE;
    const chunks = chunksInReach(size / 2, size / 2, size);
    expect(chunks[0]).toMatchObject({ cx: 0, cy: 0, key: "0,0" });
    expect(chunks.map((c) => c.key)).toEqual(
      expect.arrayContaining(["1,0", "-1,0", "0,1", "0,-1"]),
    );
    // Diagonal neighbours' nearest corners are √2·size/2 ≈ 0.71·size away: inside.
    expect(chunks.map((c) => c.key)).toContain("1,1");
    expect(chunks.map((c) => c.key)).not.toContain("2,0");
  });
});

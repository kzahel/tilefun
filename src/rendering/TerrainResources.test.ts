import { describe, expect, it, vi } from "vitest";
import { Chunk } from "../world/Chunk.js";
import { Camera } from "./Camera.js";
import { drawScene2D } from "./Canvas2DRenderer.js";
import { CanvasTerrainResources } from "./CanvasTerrainResources.js";
import type { ElevationItem } from "./SceneItem.js";

const image = () => ({ width: 256, height: 256 }) as OffscreenCanvas;

describe("terrain resource handles", () => {
  it("never aliases a released resource across rebuild, replacement, reset or backend", () => {
    const resources = new CanvasTerrainResources();
    const other = new CanvasTerrainResources();
    const chunk = new Chunk();
    const original = image();
    resources.publish(chunk, 0, 0, original);
    const first = resources.resourceId(chunk);
    if (first === null) throw Error("Missing resource");
    expect(resources.resolve(first)).toBe(original);
    resources.invalidateAssets();
    expect(resources.isReady(chunk)).toBe(false);
    expect(resources.resolve(first)).toBe(original); // Old completed imagery during catch-up.
    resources.publish(chunk, 0, 0, image());
    expect(resources.resolve(first)).toBeNull();
    const second = resources.resourceId(chunk);
    if (second === null) throw Error("Missing resource");
    expect(second).not.toBe(first);
    const replacement = new Chunk();
    resources.publish(replacement, 0, 0, image());
    expect(resources.resourceId(chunk)).toBeNull();
    expect(resources.resolve(second)).toBeNull();
    expect(resources.size).toBe(1);
    const third = resources.resourceId(replacement);
    if (third === null) throw Error("Missing resource");
    resources.clear();
    resources.publish(replacement, 0, 0, image());
    other.publish(replacement, 0, 0, image());
    expect(resources.resolve(third)).toBeNull();
    expect(other.resolve(third)).toBeNull();
    expect(other.resourceId(replacement)).not.toBe(resources.resourceId(replacement));
    expect(resources.isReady(replacement, 1, 0)).toBe(false);
  });

  it("resolves imagery only at the Canvas boundary and skips expired elevation handles", () => {
    const resources = new CanvasTerrainResources();
    const chunk = new Chunk();
    const surface = image();
    resources.publish(chunk, 0, 0, surface);
    const id = resources.resourceId(chunk);
    if (id === null) throw Error("Missing resource");
    const item: ElevationItem = {
      kind: "elevation",
      phase: "surface",
      terrainResource: id,
      wx: 16,
      wy: 32,
      srcX: 16,
      srcY: 32,
      height: 2,
      sortKey: 0,
    };
    const camera = new Camera();
    const drawImage = vi.fn();
    const fillRect = vi.fn();
    const ctx = { drawImage, fillRect } as unknown as CanvasRenderingContext2D;
    const resolver = { resolveTerrainResource: resources.resolve.bind(resources) };
    drawScene2D(
      ctx,
      camera,
      [item, { ...item, phase: "cliff" }],
      new Map(),
      undefined,
      false,
      resolver,
    );
    expect(drawImage).toHaveBeenCalledTimes(2);
    expect(drawImage.mock.calls[0]?.slice(0, 5)).toEqual([surface, 16, 32, 16, 16]);
    expect(drawImage.mock.calls[1]?.slice(0, 5)).toEqual([surface, 16, 47, 16, 1]);
    resources.delete(chunk);
    drawImage.mockClear();
    fillRect.mockClear();
    drawScene2D(ctx, camera, [item], new Map(), undefined, false, resolver);
    expect(drawImage).not.toHaveBeenCalled();
    expect(fillRect).not.toHaveBeenCalled();
    expect(() => drawScene2D(ctx, camera, [item], new Map(), undefined)).toThrow(
      "terrain resources",
    );
  });
});

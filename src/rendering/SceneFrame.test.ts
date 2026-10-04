import { afterEach, expect, it, vi } from "vitest";
import { TerrainId } from "../autotile/TerrainId.js";
import { createPlayer } from "../entities/Player.js";
import { Chunk } from "../world/Chunk.js";
import { Camera } from "./Camera.js";
import { collectScene } from "./collectScene.js";
import { SceneFrame } from "./SceneFrame.js";
import type { ElevationItem, ParticleItem } from "./SceneItem.js";
import type { TerrainResourceId } from "./TerrainPresentation.js";
import type { TileRenderer } from "./TileRenderer.js";

afterEach(() => vi.restoreAllMocks());

it("preserves sorted mixed scenes across borrowed frames and releases surface/particle references", () => {
  vi.spyOn(performance, "now").mockReturnValue(750);
  const frame = new SceneFrame();
  const chunk = new Chunk();
  chunk.autotileComputed = true;
  chunk.blendBase.fill(TerrainId.Grass);
  const camera = new Camera();
  camera.setViewport(768, 768);
  camera.snapTo(128, 128);
  const world = { getHeightAt: () => 0, getChunkIfLoaded: () => chunk, getRoadAt: () => 0 };
  const player = createPlayer(32, 80);
  const elevation: ElevationItem = {
    kind: "elevation",
    phase: "cliff",
    sortKey: 80,
    wx: 32,
    wy: 64,
    terrainResource: 1 as TerrainResourceId,
    srcX: 0,
    srcY: 0,
    height: 1,
  };
  const particle: ParticleItem = {
    kind: "particle",
    sortKey: 80,
    wx: 32,
    wy: 80,
    z: 0,
    size: 2,
    color: "red",
    alpha: 1,
  };
  const renderer = { collectElevationItems: () => [elevation] } as unknown as TileRenderer;
  const collect = (storage?: SceneFrame, grass = true) =>
    collectScene(
      [player],
      [],
      world,
      camera,
      camera.getVisibleChunkRange(),
      0.5,
      renderer,
      [particle],
      grass,
      undefined,
      undefined,
      storage,
    );
  const first = collect(frame);
  expect(first).toEqual(collect());
  const poolCount = frame.grass.getDiagnostics().createdItems;
  frame.release();
  expect(first).toEqual([]);
  player.position.wy = 120;
  const second = collect(frame);
  expect(second).toBe(first);
  expect(second).toEqual(collect());
  expect(frame.grass.getDiagnostics().createdItems).toBe(poolCount);
  expect(collect(frame, false)).toEqual(collect(undefined, false));
  expect(frame.grass.getDiagnostics().retainedItems).toBe(0);
  collect(frame);
  frame.clear();
  expect(frame.items).toEqual([]);
  expect(frame.grass.getDiagnostics().positionCapacity).toBe(0);
  expect(frame.grass.getDiagnostics().retainedItems).toBe(0);
});

it("omits distant grass work and restores full detail through pooled fade transitions", () => {
  vi.spyOn(performance, "now").mockReturnValue(750);
  const frame = new SceneFrame();
  const chunk = new Chunk();
  chunk.autotileComputed = true;
  chunk.blendBase.fill(TerrainId.Grass);
  const read = vi.fn(() => chunk);
  const world = { getHeightAt: () => 0, getRoadAt: () => 0, getChunkIfLoaded: read };
  const camera = new Camera();
  camera.setViewport(768, 768);
  camera.snapTo(128, 128);
  const range = { minCx: 0, maxCx: 0, minCy: 0, maxCy: 0 };
  const terrain = { collectElevationItems: () => [] };
  const collect = (zoom: number, storage?: SceneFrame) => {
    camera.zoom = zoom;
    return collectScene(
      [],
      [],
      world,
      camera,
      range,
      1,
      terrain,
      [],
      true,
      undefined,
      undefined,
      storage,
    );
  };
  const full = structuredClone(collect(0.5, frame));
  expect(full.length).toBeGreaterThan(0);
  const faded = collect(0.375, frame);
  expect(faded).toEqual(collect(0.375));
  expect(faded).toHaveLength(full.length);
  expect(faded.every((item) => item.kind === "grass" && item.alpha === 0.5)).toBe(true);
  expect(collect(0.5, frame)).toEqual(full);
  for (const zoom of [0.25, 0.1]) {
    read.mockClear();
    expect(collect(zoom, frame)).toEqual([]);
    expect(collect(zoom)).toEqual([]);
    expect(read).not.toHaveBeenCalled();
    expect(frame.grass.getDiagnostics()).toMatchObject({
      activeItems: 0,
      retainedItems: 0,
      positionCapacity: 0,
    });
  }
  // Re-entry reads current content, not a stale list retained by the LOD policy.
  chunk.roadGrid.fill(1);
  chunk.revision++;
  expect(collect(0.5, frame)).toEqual([]);
  chunk.roadGrid.fill(0);
  chunk.revision++;
  expect(collect(0.5, frame)).toEqual(full);
  expect(collect(1, frame)).toEqual(full);
});

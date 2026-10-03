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

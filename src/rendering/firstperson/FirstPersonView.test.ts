import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { CHUNK_SIZE, TILE_SIZE } from "../../config/constants.js";
import { Chunk } from "../../world/Chunk.js";
import type { View3dTarget } from "../View3dHost.js";
import { chunksInReach, terrainStale } from "./FirstPersonChunks.js";
import {
  type FirstPersonFrame,
  FirstPersonView,
  type FirstPersonWorld,
} from "./FirstPersonView.js";

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

describe("the view's merged static world (251)", () => {
  /** A renderer that draws nothing; the view only needs its calls to exist. */
  const renderer = {
    info: { autoReset: true, reset() {}, render: { calls: 0 } },
    initRenderTarget() {},
    getRenderTarget: () => null,
    setRenderTarget() {},
    setClearColor() {},
    clear() {},
    render() {},
  } as unknown as THREE.WebGLRenderer;
  const pages = { atlas: null, pageSize: 512, ground: () => undefined, page: () => undefined };
  const target = {
    renderer,
    width: 1280,
    height: 800,
    generation: 0,
    meshes: { ready: new Set<string>(), asset: () => undefined },
    pages,
  } as unknown as View3dTarget;
  /** Loaded chunks by key; raised chunks have one cliff around a raised tile. */
  function world(loaded: Map<string, Chunk>): FirstPersonWorld {
    return {
      getChunkIfLoaded: (cx: number, cy: number) => loaded.get(`${cx},${cy}`),
      getHeightAt: () => 0,
    } as unknown as FirstPersonWorld;
  }
  const frame = (w: FirstPersonWorld, topDown: boolean): FirstPersonFrame => ({
    eye: { x: 128, y: 128, z: 20, yaw: 0, pitch: 0 },
    world: w,
    realm: "test",
    props: [],
    sprites: [],
    drawRadius: 300,
    shadows: false,
    topDown: topDown ? { scale: 3 } : undefined,
  });
  const settle = (view: FirstPersonView, f: FirstPersonFrame) => {
    for (let i = 0; i < 60; i++) {
      view.render(f, target);
      if (!view.stats.builds) return;
    }
    throw Error("chunks kept building");
  };
  const internals = (view: FirstPersonView) =>
    view as unknown as { groundRoot: THREE.Group; ground: { count: number; meshes: number } };

  it("draws every chunk's ground as one mesh, with walls only where ground is raised", () => {
    const loaded = new Map<string, Chunk>();
    for (let cy = -1; cy <= 1; cy++)
      for (let cx = -1; cx <= 1; cx++) loaded.set(`${cx},${cy}`, new Chunk());
    loaded.get("0,0")?.setHeight(5, 5, 2);
    const view = new FirstPersonView(new Map());
    settle(view, frame(world(loaded), false));
    expect(view.stats.chunks).toBe(9);
    expect(internals(view).ground.count).toBe(9);
    // Nine chunks share one ground mesh; the raised tile's area adds one of walls.
    expect(internals(view).ground.meshes).toBe(1);
    expect(view.stats.meshes).toBe(2);
    const walls = internals(view).groundRoot.children.filter(
      (child) => child instanceof THREE.Mesh,
    ) as THREE.Mesh[];
    expect(walls).toHaveLength(1);
    expect(walls[0]?.geometry.getAttribute("position").count).toBe(4 * 6);
    // Walls cast the sun's shadow; ground tops are not drawn into its map.
    expect(walls[0]?.layers.isEnabled(1)).toBe(true);
    view.dispose();
  });

  it("keeps the same chunks when a seat switches to the top-down camera, and frees those that leave", () => {
    const loaded = new Map<string, Chunk>();
    for (let cy = -1; cy <= 1; cy++)
      for (let cx = -1; cx <= 1; cx++) loaded.set(`${cx},${cy}`, new Chunk());
    const w = world(loaded);
    const view = new FirstPersonView(new Map());
    settle(view, frame(w, false));
    view.render(frame(w, true), target);
    // The top-down ground on screen is inside the chunks already built.
    expect(view.stats.builds).toBe(0);
    expect(internals(view).ground.count).toBe(9);
    // An edited chunk is rebuilt in its own slot.
    const chunk = loaded.get("0,0") as Chunk;
    chunk.visualRevision++;
    view.render(frame(w, true), target);
    expect(view.stats.builds).toBe(1);
    expect(internals(view).ground.count).toBe(9);
    // Another world: nothing of the old one is left.
    settle(view, { ...frame(world(new Map([["0,0", new Chunk()]])), true), realm: "other" });
    expect(view.stats.chunks).toBe(1);
    expect(internals(view).ground.count).toBe(1);
    expect(view.stats.meshes).toBe(1);
    view.dispose();
    expect(internals(view).ground.meshes).toBe(0);
  });
});

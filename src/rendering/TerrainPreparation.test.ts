import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Chunk } from "../world/Chunk.js";
import { World } from "../world/World.js";
import { Camera } from "./Camera.js";
import { TERRAIN_PACING } from "./PresentationSettings.js";
import { TerrainFrame } from "./TerrainFrame.js";
import { TileRenderer } from "./TileRenderer.js";

class Surface {
  readonly context = { imageSmoothingEnabled: false, clearRect: vi.fn(), drawImage: vi.fn() };
  constructor(
    readonly width: number,
    readonly height: number,
  ) {}
  getContext() {
    return this.context;
  }
}
const visible = { minCx: 0, minCy: 0, maxCx: 0, maxCy: 0 };
const sheets = new Map();
function scene() {
  const camera = new Camera();
  camera.zoom = 1 / 3;
  camera.snapTo(128, 128);
  camera.setViewport(256, 256);
  const world = new World();
  for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) world.chunks.put(x, y, new Chunk());
  return { camera, world };
}
function drawing(renderer: TileRenderer) {
  return vi
    .spyOn(
      renderer as unknown as {
        drawCacheRows(
          chunk: Chunk,
          cx: number,
          cy: number,
          sheets: unknown,
          ctx: unknown,
          start: number,
          end: number,
          road: unknown,
        ): void;
      },
      "drawCacheRows",
    )
    .mockImplementation(() => {});
}

beforeEach(() => vi.stubGlobal("OffscreenCanvas", Surface));
afterEach(() => vi.unstubAllGlobals());

describe("terrain preparation", () => {
  it("prepares visible gaps before the loaded halo and eventually fills all residency", () => {
    const { camera, world } = scene();
    const renderer = new TileRenderer();
    const draw = drawing(renderer);
    renderer.prepareTerrain(camera, world, sheets, visible, Infinity, 16);
    expect(draw.mock.calls.every((call) => call[1] === 0 && call[2] === 0)).toBe(true);
    expect(renderer.getTerrainSurface(world.getChunkIfLoaded(0, 0))).toBeTruthy();
    expect(renderer.getDiagnostics().pending).toBe(8);
    renderer.prepareTerrain(camera, world, sheets, visible, Infinity, 128);
    expect(renderer.getDiagnostics()).toMatchObject({ resident: 9, pending: 0, building: 0 });
    expect(world.chunks.loadedCount).toBe(9); // prefetch never generates data
  });

  it("checks elapsed time between rows and also respects a hard row bound", () => {
    const { camera, world } = scene();
    let now = 0;
    const renderer = new TileRenderer(() => now);
    const draw = drawing(renderer);
    draw.mockImplementation(() => {
      now++;
    });
    renderer.prepareTerrain(camera, world, sheets, visible, 2, 128);
    expect(draw).toHaveBeenCalledTimes(2);
    renderer.prepareTerrain(camera, world, sheets, visible, 100, 3);
    expect(draw).toHaveBeenCalledTimes(5);
    expect(renderer.getDiagnostics().rowsLastFrame).toBe(3);
  });

  it("keeps completed imagery during a revision rebuild and restarts stale partial work", () => {
    const { camera, world } = scene();
    const renderer = new TileRenderer();
    const draw = drawing(renderer);
    renderer.prepareTerrain(camera, world, sheets, visible, Infinity, 16);
    const chunk = world.getChunkIfLoaded(0, 0);
    if (!chunk) throw Error("Missing fixture");
    const original = renderer.getTerrainSurface(chunk);
    chunk.revision++;
    chunk.invalidateVisuals();
    renderer.prepareTerrain(camera, world, sheets, visible, Infinity, 4);
    expect(renderer.getTerrainSurface(chunk)).toBe(original);
    chunk.revision++;
    renderer.prepareTerrain(camera, world, sheets, visible, Infinity, 12);
    expect(renderer.getTerrainSurface(chunk)).toBe(original);
    expect(renderer.isTerrainReady(chunk)).toBe(false);
    renderer.prepareTerrain(camera, world, sheets, visible, Infinity, 4);
    expect(renderer.getTerrainSurface(chunk)).not.toBe(original);
    expect(renderer.isTerrainReady(chunk)).toBe(true);
    expect(draw).toHaveBeenCalledTimes(36);
  });

  it("does not reuse a partial canvas for another chunk object with the same revision", () => {
    const { camera, world } = scene();
    const renderer = new TileRenderer();
    drawing(renderer);
    renderer.prepareTerrain(camera, world, sheets, visible, Infinity, 8);
    const replacement = new Chunk();
    world.chunks.put(0, 0, replacement);
    renderer.prepareTerrain(camera, world, sheets, visible, Infinity, 8);
    expect(renderer.getTerrainSurface(replacement)).toBeNull();
    renderer.prepareTerrain(camera, world, sheets, visible, Infinity, 8);
    expect(renderer.getTerrainSurface(replacement)).toBeTruthy();
  });

  it("bounds residency when moving and releases surfaces on realm reset", () => {
    const { camera, world } = scene();
    const renderer = new TileRenderer();
    drawing(renderer);
    renderer.prepareTerrain(camera, world, sheets, visible, Infinity, 144);
    const old = world.getChunkIfLoaded(0, 0);
    expect(renderer.getTerrainSurface(old)).toBeTruthy();
    world.chunks.put(100, 100, new Chunk());
    renderer.prepareTerrain(
      camera,
      world,
      sheets,
      { minCx: 100, minCy: 100, maxCx: 100, maxCy: 100 },
      Infinity,
      16,
    );
    expect(renderer.getTerrainSurface(old)).toBeNull();
    expect(renderer.getDiagnostics()).toMatchObject({ resident: 1, building: 0, pending: 0 });
    renderer.clear();
    expect(renderer.getTerrainSurface(world.getChunkIfLoaded(100, 100))).toBeNull();
    expect(renderer.getDiagnostics()).toMatchObject({ resident: 0, building: 0, surfaceBytes: 0 });
  });

  it("retains halo work during the draw-only pass and prioritizes the direction of travel", () => {
    const { camera, world } = scene();
    const renderer = new TileRenderer();
    const draw = drawing(renderer);
    renderer.prepareTerrain(camera, world, sheets, visible, Infinity, 16);
    camera.x++;
    draw.mockClear();
    renderer.prepareTerrain(camera, world, sheets, visible, Infinity, 1);
    expect(draw.mock.calls[0]?.slice(1, 3)).toEqual([1, 0]);
    new TerrainFrame().collect(camera, world, renderer, visible);
    expect(renderer.getDiagnostics().building).toBe(1);
  });

  it("reuses warm records while detecting unloads and arrivals inside an unchanged range", () => {
    const { camera, world } = scene();
    const renderer = new TileRenderer();
    drawing(renderer);
    renderer.prepareTerrain(camera, world, sheets, visible, Infinity, 144);
    for (let i = 0; i < 10; i++) renderer.prepareTerrain(camera, world, sheets, visible, 0, 0);
    expect(renderer.getDiagnostics()).toMatchObject({ schedulerRecordsCreated: 9, queuedJobs: 0 });
    const removed = world.getChunkIfLoaded(1, 0);
    world.chunks.remove("1,0");
    renderer.prepareTerrain(camera, world, sheets, visible, 0, 0);
    expect(renderer.getTerrainSurface(removed)).toBeNull();
    expect(renderer.isTerrainReady(removed)).toBe(false);
    expect(renderer.getDiagnostics()).toMatchObject({ resident: 8, pending: 0 });
    const arrival = new Chunk();
    world.chunks.put(1, 0, arrival);
    renderer.prepareTerrain(camera, world, sheets, visible, Infinity, 16);
    expect(renderer.getTerrainSurface(arrival)).toBeTruthy();
    expect(renderer.getDiagnostics()).toMatchObject({
      resident: 9,
      pending: 0,
      schedulerRecordsCreated: 10,
      queuedJobs: 0,
    });
  });

  it("preserves pending age but resets it for replacements and newly edited ready chunks", () => {
    const { camera, world } = scene();
    let now = 10;
    const renderer = new TileRenderer(() => now);
    drawing(renderer);
    renderer.prepareTerrain(camera, world, sheets, visible, Infinity, 144);
    const chunk = world.getChunkIfLoaded(0, 0);
    if (!chunk) throw Error("Missing fixture");
    chunk.invalidateVisuals();
    renderer.prepareTerrain(camera, world, sheets, visible, 0, 0);
    now = 30;
    renderer.prepareTerrain(camera, world, sheets, visible, 0, 0);
    expect(renderer.getDiagnostics()).toMatchObject({ pending: 1, oldestMs: 20 });
    const replacement = new Chunk();
    world.chunks.put(0, 0, replacement);
    renderer.prepareTerrain(camera, world, sheets, visible, 0, 0);
    expect(renderer.getTerrainSurface(chunk)).toBeNull();
    expect(renderer.getDiagnostics()).toMatchObject({ oldestMs: 0, schedulerRecordsCreated: 9 });
    now = 40;
    renderer.prepareTerrain(camera, world, sheets, visible, Infinity, 16);
    expect(renderer.getDiagnostics()).toMatchObject({ pending: 0 });
    replacement.invalidateVisuals();
    now = 70;
    renderer.prepareTerrain(camera, world, sheets, visible, 0, 0);
    expect(renderer.getDiagnostics()).toMatchObject({ pending: 1, oldestMs: 0 });
  });

  it("reprioritizes on reversal, with visible holes before replacements before halo work", () => {
    const { camera, world } = scene();
    const renderer = new TileRenderer();
    const draw = drawing(renderer);
    renderer.prepareTerrain(camera, world, sheets, visible, Infinity, 16);
    camera.x++;
    renderer.prepareTerrain(camera, world, sheets, visible, Infinity, 1);
    expect(draw.mock.calls.at(-1)?.slice(1, 3)).toEqual([1, 0]);
    camera.x--;
    renderer.prepareTerrain(camera, world, sheets, visible, Infinity, 1);
    expect(draw.mock.calls.at(-1)?.slice(1, 3)).toEqual([-1, 0]);
    const chunk = world.getChunkIfLoaded(0, 0);
    if (!chunk) throw Error("Missing fixture");
    chunk.invalidateVisuals();
    // 0,0 has old imagery; the newly visible 1,0 has a hole, despite its distance.
    const wider = { ...visible, maxCx: 1 };
    draw.mockClear();
    renderer.prepareTerrain(camera, world, sheets, wider, Infinity, 16);
    expect(draw.mock.calls[0]?.slice(1, 3)).toEqual([1, 0]);
    expect(draw.mock.calls.at(-1)?.slice(1, 3)).toEqual([0, 0]);
    expect(renderer.getDiagnostics().queuedJobs).toBe(0);
  });

  it("discards fallback partial work outside preparation residency even with no row budget", () => {
    const { camera, world } = scene();
    const renderer = new TileRenderer();
    drawing(renderer);
    renderer.prepareVisibleTerrain(camera, world, sheets, visible, 1);
    expect(renderer.getDiagnostics()).toMatchObject({ resident: 0, building: 1 });
    renderer.prepareTerrain(
      camera,
      world,
      sheets,
      { minCx: 100, maxCx: 100, minCy: 100, maxCy: 100 },
      0,
      0,
    );
    expect(renderer.getDiagnostics()).toMatchObject({ resident: 0, building: 0, queuedJobs: 0 });
  });

  it("releases borrowed references on exceptions and can prepare again after reset", () => {
    const { camera, world } = scene();
    const renderer = new TileRenderer();
    const draw = drawing(renderer);
    draw.mockImplementationOnce(() => {
      throw Error("draw failed");
    });
    expect(() => renderer.prepareTerrain(camera, world, sheets, visible, Infinity, 16)).toThrow(
      "draw failed",
    );
    expect(renderer.getDiagnostics()).toMatchObject({ resident: 0, building: 0, queuedJobs: 0 });
    renderer.prepareTerrain(camera, world, sheets, visible, Infinity, 144);
    expect(renderer.getDiagnostics()).toMatchObject({ resident: 9, pending: 0, queuedJobs: 0 });
    renderer.clear();
    expect(renderer.getDiagnostics()).toMatchObject({
      resident: 0,
      building: 0,
      queuedJobs: 0,
      surfaceBytes: 0,
    });
  });

  it("keeps two renderer caches independent across edits, asset changes and teardown", () => {
    const { camera, world } = scene();
    const a = new TileRenderer();
    const b = new TileRenderer();
    drawing(a);
    drawing(b);
    const chunk = world.getChunkIfLoaded(0, 0);
    if (!chunk) throw Error("Missing fixture");
    const version = chunk.visualRevision;
    a.prepareTerrain(camera, world, sheets, visible, Infinity, 16);
    b.prepareTerrain(camera, world, sheets, visible, Infinity, 16);
    expect(a.getTerrainSurface(chunk)).not.toBe(b.getTerrainSurface(chunk));
    expect(chunk.visualRevision).toBe(version);
    chunk.invalidateVisuals(); // Derived changes need not change replicated revision.
    a.prepareTerrain(camera, world, sheets, visible, Infinity, 16);
    expect(a.isTerrainReady(chunk)).toBe(true);
    expect(b.isTerrainReady(chunk)).toBe(false);
    b.prepareTerrain(camera, world, sheets, visible, Infinity, 16);
    expect(b.isTerrainReady(chunk)).toBe(true);
    const old = a.getTerrainSurface(chunk);
    a.invalidateAssets();
    expect(a.isTerrainReady(chunk)).toBe(false);
    expect(a.getTerrainSurface(chunk)).toBe(old);
    expect(b.isTerrainReady(chunk)).toBe(true);
    a.prepareTerrain(camera, world, sheets, visible, Infinity, 8);
    a.invalidateAssets();
    a.prepareTerrain(camera, world, sheets, visible, Infinity, 8);
    expect(a.getTerrainSurface(chunk)).toBe(old);
    a.prepareTerrain(camera, world, sheets, visible, Infinity, 8);
    expect(a.getTerrainSurface(chunk)).not.toBe(old);
    a.clear();
    expect(b.isTerrainReady(chunk)).toBe(true);
    expect(chunk.visualRevision).toBe(version + 1);
  });

  it("restarts partial imagery for local visual changes at equal replicated revision", () => {
    const { camera, world } = scene();
    const renderer = new TileRenderer();
    drawing(renderer);
    const chunk = world.getChunkIfLoaded(0, 0);
    if (!chunk) throw Error("Missing fixture");
    renderer.prepareTerrain(camera, world, sheets, visible, Infinity, 8);
    chunk.invalidateVisuals();
    renderer.prepareTerrain(camera, world, sheets, visible, Infinity, 8);
    expect(renderer.getTerrainSurface(chunk)).toBeNull();
    renderer.prepareTerrain(camera, world, sheets, visible, Infinity, 8);
    expect(renderer.isTerrainReady(chunk)).toBe(true);
  });

  it("bounds fallback surfaces when chunk identity changes at a resident coordinate", () => {
    const { camera, world } = scene();
    const renderer = new TileRenderer();
    drawing(renderer);
    renderer.prepareVisibleTerrain(camera, world, sheets, visible, 16);
    const old = world.getChunkIfLoaded(0, 0);
    world.chunks.put(0, 0, new Chunk());
    renderer.prepareVisibleTerrain(camera, world, sheets, visible, 16);
    expect(renderer.getTerrainSurface(old)).toBeNull();
    expect(renderer.getDiagnostics().surfaceBytes).toBe(256 * 256 * 4);
    renderer.prepareTerrain(
      camera,
      world,
      sheets,
      { minCx: 100, maxCx: 100, minCy: 100, maxCy: 100 },
      0,
      0,
    );
    expect(renderer.getDiagnostics().surfaceBytes).toBe(0);
  });
});

it("submits reusable neutral placements and retires partial identities on restart, replacement and clear", () => {
  const { camera, world } = scene();
  const renderer = new TileRenderer();
  drawing(renderer);
  const frame = new TerrainFrame();
  const collect = (budget = 4, readyOnly = false) => {
    if (budget > 0) renderer.prepareVisibleTerrain(camera, world, sheets, visible, budget);
    return frame.collect(camera, world, renderer, visible, { readyOnly });
  };
  const first = collect();
  const draw = first[0];
  if (!draw) throw Error("Missing partial placement");
  const id = draw.resource;
  expect(draw).toMatchObject({ x: 0, y: 0, width: 257, height: 257 });
  expect(renderer.resolveTerrainResource(id)).not.toBeNull();
  expect(collect(0)[0]).toBe(draw);
  expect(collect(0, true)).toEqual([]);
  const chunk = world.getChunkIfLoaded(0, 0);
  if (!chunk) throw Error("Missing chunk");
  chunk.invalidateVisuals();
  expect(collect(0)).toEqual([]); // stale partial pixels must not be submitted
  collect();
  expect(renderer.resolveTerrainResource(id)).toBeNull();
  const secondId = draw.resource;
  world.chunks.put(0, 0, new Chunk());
  collect();
  expect(renderer.resolveTerrainResource(secondId)).toBeNull();
  const replacementId = draw.resource;
  collect(16);
  expect(renderer.resolveTerrainResource(replacementId)).toBeNull();
  expect(renderer.isTerrainReady(world.getChunkIfLoaded(0, 0))).toBe(true);
  const completeId = draw.resource;
  renderer.clear();
  frame.clear();
  expect(first).toEqual([]);
  expect(renderer.resolveTerrainResource(completeId)).toBeNull();
});

it("responsive publication caps visible debt, retains replacements and reuses warm surfaces", () => {
  const { camera, world } = scene();
  const renderer = new TileRenderer(() => 0);
  const draw = drawing(renderer);
  const policy = TERRAIN_PACING.responsive;
  const range = { minCx: -1, minCy: -1, maxCx: 1, maxCy: 1 };
  const frame = new TerrainFrame();
  const prepare = () => {
    renderer.prepareTerrain(
      camera,
      world,
      sheets,
      range,
      policy.preparation.timeBudgetMs,
      policy.preparation.rowBudget,
    );
    expect(renderer.getDiagnostics().rowsLastFrame).toBeLessThanOrEqual(2);
  };
  const center = world.getChunkIfLoaded(0, 0);
  if (!center) throw Error("Missing center");
  prepare();
  expect(draw.mock.calls.every((c) => c[1] === 0 && c[2] === 0)).toBe(true);
  expect(frame.collect(camera, world, renderer, visible, policy.drawing)).toHaveLength(0);
  expect(frame.collect(camera, world, renderer, visible)).toHaveLength(1); // partial is opt-in
  for (let i = 1; i < 8; i++) prepare();
  expect(frame.collect(camera, world, renderer, visible, policy.drawing)).toHaveLength(1);
  const original = renderer.groundResourceId(center, 0, 0, true);
  for (let i = 8; i < 72; i++) prepare();
  expect(renderer.getDiagnostics().pending).toBe(0);
  const draws = draw.mock.calls.length;
  for (let i = 0; i < 30; i++) prepare();
  expect(draw.mock.calls).toHaveLength(draws);
  expect(renderer.getDiagnostics()).toMatchObject({ rowsLastFrame: 0, building: 0 });
  center.revision++;
  prepare();
  expect(renderer.groundResourceId(center, 0, 0, true)).toBe(original);
  for (let i = 1; i < 8; i++) prepare();
  expect(renderer.groundResourceId(center, 0, 0, true)).not.toBe(original);
  expect(renderer.isTerrainReady(center)).toBe(true);
});

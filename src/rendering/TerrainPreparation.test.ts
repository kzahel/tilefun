import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Chunk } from "../world/Chunk.js";
import { World } from "../world/World.js";
import { Camera } from "./Camera.js";
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
    expect(world.getChunkIfLoaded(0, 0)?.renderCache).toBeTruthy();
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
    const original = chunk.renderCache;
    chunk.revision++;
    chunk.dirty = true;
    renderer.prepareTerrain(camera, world, sheets, visible, Infinity, 4);
    expect(chunk.renderCache).toBe(original);
    chunk.revision++;
    renderer.prepareTerrain(camera, world, sheets, visible, Infinity, 12);
    expect(chunk.renderCache).toBe(original);
    expect(chunk.dirty).toBe(true);
    renderer.prepareTerrain(camera, world, sheets, visible, Infinity, 4);
    expect(chunk.renderCache).not.toBe(original);
    expect(chunk.dirty).toBe(false);
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
    expect(replacement.renderCache).toBeNull();
    renderer.prepareTerrain(camera, world, sheets, visible, Infinity, 8);
    expect(replacement.renderCache).toBeTruthy();
  });

  it("bounds residency when moving and releases surfaces on realm reset", () => {
    const { camera, world } = scene();
    const renderer = new TileRenderer();
    drawing(renderer);
    renderer.prepareTerrain(camera, world, sheets, visible, Infinity, 144);
    const old = world.getChunkIfLoaded(0, 0);
    expect(old?.renderCache).toBeTruthy();
    world.chunks.put(100, 100, new Chunk());
    renderer.prepareTerrain(
      camera,
      world,
      sheets,
      { minCx: 100, minCy: 100, maxCx: 100, maxCy: 100 },
      Infinity,
      16,
    );
    expect(old?.renderCache).toBeNull();
    expect(renderer.getDiagnostics()).toMatchObject({ resident: 1, building: 0, pending: 0 });
    renderer.clear();
    expect(world.getChunkIfLoaded(100, 100)?.renderCache).toBeNull();
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
    const ctx = {
      canvas: { width: 256, height: 256 },
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    renderer.drawTerrain(ctx, camera, world, sheets, visible, false, 0);
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
    expect(removed?.renderCache).toBeNull();
    expect(removed?.dirty).toBe(true);
    expect(renderer.getDiagnostics()).toMatchObject({ resident: 8, pending: 0 });
    const arrival = new Chunk();
    world.chunks.put(1, 0, arrival);
    renderer.prepareTerrain(camera, world, sheets, visible, Infinity, 16);
    expect(arrival.renderCache).toBeTruthy();
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
    chunk.dirty = true;
    renderer.prepareTerrain(camera, world, sheets, visible, 0, 0);
    now = 30;
    renderer.prepareTerrain(camera, world, sheets, visible, 0, 0);
    expect(renderer.getDiagnostics()).toMatchObject({ pending: 1, oldestMs: 20 });
    const replacement = new Chunk();
    world.chunks.put(0, 0, replacement);
    renderer.prepareTerrain(camera, world, sheets, visible, 0, 0);
    expect(chunk.renderCache).toBeNull();
    expect(renderer.getDiagnostics()).toMatchObject({ oldestMs: 0, schedulerRecordsCreated: 9 });
    now = 40;
    renderer.prepareTerrain(camera, world, sheets, visible, Infinity, 16);
    expect(renderer.getDiagnostics()).toMatchObject({ pending: 0 });
    replacement.dirty = true;
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
    chunk.dirty = true;
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
    const ctx = {
      canvas: { width: 256, height: 256 },
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    renderer.drawTerrain(ctx, camera, world, sheets, visible, false, 1);
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
});

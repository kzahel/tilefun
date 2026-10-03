import { afterEach, expect, it, vi } from "vitest";
import { Spritesheet } from "../assets/Spritesheet.js";
import { Chunk } from "../world/Chunk.js";
import { World } from "../world/World.js";
import { Camera } from "./Camera.js";
import { CanvasRenderBackend } from "./CanvasRenderBackend.js";
import { createCanvasRenderHost } from "./CanvasRenderHost.js";
import { TileRenderer } from "./TileRenderer.js";

class Surface extends EventTarget {
  width = 256;
  height = 256;
  readonly ctx = {
    canvas: this,
    imageSmoothingEnabled: false,
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
  };
  getContext() {
    return this.ctx;
  }
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("preserves resources across resize, invalidates explicitly, and disposes without closing borrowed sources", () => {
  vi.stubGlobal("OffscreenCanvas", Surface);
  const surface = new Surface();
  const tile = new TileRenderer();
  vi.spyOn(tile as unknown as { drawCacheRows(): void }, "drawCacheRows").mockImplementation(
    () => {},
  );
  const image = { width: 16, height: 16, close: vi.fn() };
  const sheets = new Map([["fixture", new Spritesheet(image as unknown as ImageBitmap, 16, 16)]]);
  const renderer = new CanvasRenderBackend(
    surface.ctx as unknown as CanvasRenderingContext2D,
    sheets,
    tile,
  );
  const camera = new Camera();
  camera.zoom = 1 / 3;
  camera.snapTo(128, 128);
  camera.setViewport(256, 256);
  const world = new World();
  const chunk = new Chunk();
  world.chunks.put(0, 0, chunk);
  const visible = { minCx: 0, minCy: 0, maxCx: 0, maxCy: 0 };
  renderer.prepareTerrain(camera, world, visible, { timeBudgetMs: Infinity, rowBudget: 16 });
  const draws = renderer.collectTerrain(camera, world, visible).map((d) => ({ ...d }));
  expect(renderer.isTerrainReady(chunk)).toBe(true);
  renderer.resize(512, 256);
  expect(surface.width).toBe(512);
  expect(renderer.isTerrainReady(chunk)).toBe(true);
  sheets.set("new-sprite", new Spritesheet(image as unknown as ImageBitmap, 16, 16));
  renderer.addSpriteAssets(sheets);
  expect(renderer.assets.has("new-sprite")).toBe(true);
  expect(renderer.isTerrainReady(chunk)).toBe(true);
  expect(renderer.collectTerrain(camera, world, visible)[0]?.resource).toBe(draws[0]?.resource);
  const replacement = new Map(sheets);
  replacement.set("fixture", new Spritesheet(image as unknown as ImageBitmap, 16, 16));
  expect(() => renderer.addSpriteAssets(replacement)).toThrow("replaced fixture");
  expect(renderer.isTerrainReady(chunk)).toBe(true);
  renderer.invalidateAssets();
  expect(renderer.hasTerrain(chunk)).toBe(true);
  expect(renderer.isTerrainReady(chunk)).toBe(false);
  renderer.submit(camera, { kind: "terrain", draws });
  expect(surface.ctx.drawImage).toHaveBeenCalledTimes(1); // completed fallback stays usable
  renderer.recover();
  surface.ctx.drawImage.mockClear();
  renderer.submit(camera, { kind: "terrain", draws });
  expect(surface.ctx.drawImage).not.toHaveBeenCalled();
  expect(renderer.getDiagnostics()).toMatchObject({ resident: 0, surfaceBytes: 0 });
  renderer.dispose();
  renderer.dispose();
  expect(renderer.assets.size).toBe(0);
  expect(sheets.size).toBe(2);
  expect(image.close).not.toHaveBeenCalled();
  expect(() => renderer.submit(camera, { kind: "clear", color: "black" })).toThrow("disposed");
  expect(() => renderer.prepareTerrain(camera, world, visible)).toThrow("disposed");
});

it("connects Canvas recovery at composition and detaches listeners on disposal", () => {
  const surface = new Surface();
  const host = createCanvasRenderHost(surface as unknown as HTMLCanvasElement);
  expect(host.uiContext).toBe(surface.ctx);
  const recover = vi.spyOn(host.renderer, "recover");
  const lost = new Event("contextlost", { cancelable: true });
  surface.dispatchEvent(lost);
  expect(lost.defaultPrevented).toBe(true);
  surface.dispatchEvent(new Event("contextrestored"));
  expect(recover).toHaveBeenCalledTimes(1);
  host.resize(390, 844);
  expect([surface.width, surface.height]).toEqual([390, 844]);
  host.dispose();
  host.dispose();
  surface.dispatchEvent(new Event("contextrestored"));
  expect(recover).toHaveBeenCalledTimes(1);
});

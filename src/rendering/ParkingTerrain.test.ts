import { afterEach, expect, it, vi } from "vitest";
import { Spritesheet } from "../assets/Spritesheet.js";
import { parkingSurfaceAt } from "../road/ParkingSurface.js";
import { Chunk } from "../world/Chunk.js";
import { World } from "../world/World.js";
import { Camera } from "./Camera.js";
import { TerrainFrame } from "./TerrainFrame.js";
import { TileRenderer } from "./TileRenderer.js";

afterEach(() => vi.unstubAllGlobals());
it("reuses native parking terrain through panning, zooming and wide desktop resize", () => {
  const drawImage = vi.fn();
  class Surface {
    constructor(
      readonly width: number,
      readonly height: number,
    ) {}
    getContext() {
      return { imageSmoothingEnabled: false, clearRect: vi.fn(), drawImage };
    }
  }
  vi.stubGlobal("OffscreenCanvas", Surface);
  const world = new World(),
    chunk = new Chunk();
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) chunk.setRoad(x, y, parkingSurfaceAt(x + 16, y + 16));
  world.chunks.put(0, 0, chunk);
  const camera = new Camera();
  camera.pixelSnap = true;
  camera.snapTo(128, 128);
  camera.setViewport(1280, 900);
  const renderer = new TileRenderer(),
    frame = new TerrainFrame();
  const sheets = new Map([
    ["me-complete", new Spritesheet({ width: 4096, height: 5000 } as HTMLCanvasElement, 16, 16)],
  ]);
  const range = { minCx: 0, maxCx: 0, minCy: 0, maxCy: 0 };
  renderer.prepareTerrain(camera, world, sheets, range, 1000, 128);
  expect(renderer.isTerrainReady(chunk)).toBe(true);
  expect(drawImage.mock.calls.length).toBeGreaterThan(256);
  const calls = drawImage.mock.calls.length;
  const handle = renderer.groundResourceId(chunk, 0, 0, false);
  for (const width of [1280, 2560, 3840])
    for (const zoom of [0.5, 0.25, 0.1]) {
      camera.setViewport(width, 1440);
      camera.zoom = zoom;
      for (let i = 0; i < 5; i++) {
        camera.x += 3;
        camera.y += 2;
        renderer.prepareTerrain(camera, world, sheets, range, 1000, 128);
        expect(renderer.getDiagnostics().rowsLastFrame).toBe(0);
        expect(renderer.groundResourceId(chunk, 0, 0, false)).toBe(handle);
        expect(frame.collect(camera, world, renderer, range)).toHaveLength(1);
      }
    }
  expect(drawImage).toHaveBeenCalledTimes(calls);
  // A real road edit still invalidates/rebuilds the affected native chunk.
  chunk.setRoad(0, 0, 0);
  chunk.invalidateVisuals();
  renderer.prepareTerrain(camera, world, sheets, range, 1000, 128);
  expect(drawImage.mock.calls.length).toBeGreaterThan(calls);
  renderer.clear();
});

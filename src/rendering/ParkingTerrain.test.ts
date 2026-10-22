import { afterEach, expect, it, vi } from "vitest";
import { Spritesheet } from "../assets/Spritesheet.js";
import { NaturalStrategy } from "../generation/regional/NaturalStrategy.js";
import { racetrackSurface } from "../generation/regional/RacetrackPlanner.js";
import { depotSurface, vehicleDepot } from "../generation/regional/VehicleDepotPlanner.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { parkingSurfaceAt } from "../road/ParkingSurface.js";
import { Chunk } from "../world/Chunk.js";
import { World } from "../world/World.js";
import { Camera } from "./Camera.js";
import { TerrainFrame } from "./TerrainFrame.js";
import { TileRenderer } from "./TileRenderer.js";

afterEach(() => vi.unstubAllGlobals());
it.each(["parking", "racetrack", "depot"])(
  "reuses %s ground through panning, zooming and resize",
  (kind) => {
    const drawImage = vi.fn(),
      fillRect = vi.fn();
    class Surface {
      constructor(
        readonly width: number,
        readonly height: number,
      ) {}
      getContext() {
        return { imageSmoothingEnabled: false, clearRect: vi.fn(), fillRect, drawImage };
      }
    }
    vi.stubGlobal("OffscreenCanvas", Surface);
    const world = new World(),
      chunk = new Chunk();
    const strategy = new NaturalStrategy(regionalWorld(2026), "balanced");
    const track = strategy.racetracks.owner(0, 0);
    if (!track) throw Error("Missing track fixture");
    const depot = vehicleDepot(track);
    const baseX = Math.floor(track.center.x / 16) * 16;
    const baseY = Math.floor((track.center.y - (kind === "racetrack" ? 25 : 0)) / 16) * 16;
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++)
        chunk.setRoad(
          x,
          y,
          kind === "parking"
            ? parkingSurfaceAt(x + 16, y + 16)
            : kind === "racetrack"
              ? racetrackSurface(track, baseX + x, baseY + y)
              : (depotSurface(depot, baseX + x, baseY + y) ?? 0),
        );
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
    const draws = () => drawImage.mock.calls.length + fillRect.mock.calls.length;
    expect(draws()).toBeGreaterThan(0);
    const calls = draws();
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
    expect(draws()).toBe(calls);
    // Explicit visual invalidation still rebuilds the affected native chunk.
    chunk.setRoad(0, 0, 0);
    chunk.invalidateVisuals();
    renderer.prepareTerrain(camera, world, sheets, range, 1000, 128);
    expect(draws()).toBeGreaterThan(calls);
    renderer.clear();
  },
);

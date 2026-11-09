import { describe, expect, it } from "vitest";
import { Chunk } from "../world/Chunk.js";
import { World } from "../world/World.js";
import { Camera } from "./Camera.js";
import { prepareViewTerrain, presentTerrain } from "./OutdoorPresentation.js";
import { RecordingBackend } from "./testing/RecordingBackend.js";
import { layoutViews, type ViewLayout, ViewLayouts } from "./ViewLayout.js";

const VIEW_LAYOUTS: readonly ViewLayout[] = ["1", "2", "4", "diagonal"];

describe("view layouts", () => {
  it.each([
    [1281, 801],
    [1280, 800],
    [3, 2],
  ])("tile a %ix%i canvas exactly; diagonal halves are complementary", (width, height) => {
    for (const layout of VIEW_LAYOUTS) {
      const views = layoutViews(layout, width, height);
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          let covering = 0;
          for (const { region: r } of views) {
            const inside = x >= r.x && y >= r.y && x < r.x + r.width && y < r.y + r.height;
            const [a, b, c] = r.mask ?? [0, 0, 1];
            if (inside && a * (x + 0.5) + b * (y + 0.5) + c >= 0) covering++;
          }
          // A pixel centre exactly on the diagonal may belong to both halves.
          if (covering !== 1) expect([layout, x, y, covering]).toEqual([layout, x, y, 2]);
          if (covering !== 1) expect(height * (x + 0.5)).toBe(width * (y + 0.5));
        }
      for (const { region } of views)
        expect(Number.isInteger(region.x + region.y + region.width + region.height)).toBe(true);
    }
  });

  it("puts each view's focus inside its own half or rectangle", () => {
    for (const layout of VIEW_LAYOUTS)
      for (const { region: r, focusX, focusY } of layoutViews(layout, 1280, 800)) {
        const [a, b, c] = r.mask ?? [0, 0, 1];
        expect(a * (r.x + focusX) + b * (r.y + focusY) + c).toBeGreaterThan(0);
        expect(focusX).toBeLessThan(r.width);
        expect(focusY).toBeLessThan(r.height);
      }
  });

  it("keeps the same regions until the layout or size changes", () => {
    const layouts = new ViewLayouts();
    const first = layouts.get("2", 1280, 800);
    expect(layouts.get("2", 1280, 800)).toBe(first);
    const resized = layouts.get("2", 1281, 800);
    expect(resized).not.toBe(first);
    expect(resized[1]?.region).toMatchObject({ x: 640, width: 641 });
    expect(layouts.get("4", 1281, 800)).toHaveLength(4);
  });
});

describe("a split frame", () => {
  it("prepares terrain once for every view, then each view draws only its own pass", () => {
    const backend = new RecordingBackend(new Map());
    const world = new World();
    for (let cy = -4; cy <= 4; cy++)
      for (let cx = -4; cx <= 4; cx++) world.chunks.put(cx, cy, new Chunk());
    const cameras: Camera[] = [];
    const frame = (layout: ViewLayout) => {
      const views = layoutViews(layout, 768, 512).map(({ region }, i) => {
        const camera = cameras[i] ?? new Camera();
        cameras[i] = camera;
        camera.zoom = 1 / 3;
        camera.setViewport(region.width, region.height);
        camera.snapTo(i * 300 - 450, i * 200 - 300);
        return { view: camera, visible: camera.getVisibleChunkRange() };
      });
      prepareViewTerrain(backend, views, world, "throughput");
      for (const { view, visible } of views)
        presentTerrain(backend, view, world, visible, "throughput", true);
      return views;
    };
    for (const [layout, n] of [
      ["1", 1],
      ["2", 2],
      ["4", 4],
      ["diagonal", 2],
    ] as const) {
      backend.passes.length = backend.preparations = 0;
      const views = frame(layout);
      expect([backend.preparations, backend.passes.length]).toEqual([1, n]);
      // A warm frame of the same views uploads nothing, however many share chunks.
      const uploads = backend.uploads;
      frame(layout);
      expect(backend.uploads).toBe(uploads);
      for (const { visible } of views)
        for (let cy = Math.max(-4, visible.minCy); cy <= Math.min(4, visible.maxCy); cy++)
          for (let cx = Math.max(-4, visible.minCx); cx <= Math.min(4, visible.maxCx); cx++)
            expect(backend.isTerrainReady(world.getChunkIfLoaded(cx, cy))).toBe(true);
    }
  });
});

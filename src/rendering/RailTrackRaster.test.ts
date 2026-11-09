import { expect, it } from "vitest";
import { nearestRail, type RailPath, railAlignment } from "../railway/RailPath.js";
import { curvedTrackPath } from "../scenarios/CurvedTrainRecipe.js";
import { drawRailTile, railPixel } from "./RailTrackRaster.js";

it("aligns pixel rails/sleepers on straights and arcs at positive and negative chunk seams", () => {
  const path = curvedTrackPath(),
    a = railAlignment(path);
  for (const p of a.samples(32)) expect(nearestRail(path, p.x, p.y).distance).toBeLessThan(0.001);
  const render = (tx: number, ty: number) => {
    const pixels = new Map<string, string>();
    let color = "";
    const ctx = {
      set fillStyle(v: string) {
        color = v;
      },
      fillRect(x: number, y: number, w: number, h: number) {
        for (let py = y; py < y + h; py++)
          for (let px = x; px < x + w; px++) pixels.set(`${tx * 16 + px},${ty * 16 + py}`, color);
      },
    };
    drawRailTile(ctx as OffscreenCanvasRenderingContext2D, [path], tx, ty, 0, 0);
    return pixels;
  };
  for (const tx of [-17, -16, -1, 0, 15, 16]) {
    const pixels = render(tx, -32);
    for (let y = -512; y < -496; y++)
      for (let x = tx * 16; x < (tx + 1) * 16; x++)
        expect(pixels.get(`${x},${y}`)).toBe(railPixel([path], x, y));
    expect([...pixels.values()]).toContain("#bac3c6");
  }
  expect(railPixel([path], 0, 0)).toBeUndefined();
});

it("culls far segments per tile without changing any pixel (232)", () => {
  const path = curvedTrackPath();
  // A second, offset path makes tiles where paths and segments compete.
  const shifted: RailPath = {
    ...path,
    segments: path.segments.map((s) =>
      s.kind === "line"
        ? { ...s, x: s.x + 37, y: s.y + 29, endX: s.endX + 37, endY: s.endY + 29 }
        : { ...s, x: s.x + 37, y: s.y + 29 },
    ),
  };
  const paths = [path, shifted];
  const bounds = railAlignment(path).bounds;
  let colored = 0,
    tiles = 0;
  for (let ty = Math.floor(bounds.minY / 16) - 3; ty <= Math.ceil(bounds.maxY / 16) + 3; ty += 3)
    for (
      let tx = Math.floor(bounds.minX / 16) - 3;
      tx <= Math.ceil(bounds.maxX / 16) + 3;
      tx += 2
    ) {
      const pixels = new Map<string, string>();
      let color = "";
      const ctx = {
        set fillStyle(v: string) {
          color = v;
        },
        fillRect(x: number, y: number, w: number, h: number) {
          for (let py = y; py < y + h; py++)
            for (let px = x; px < x + w; px++) pixels.set(`${px},${py}`, color);
        },
      };
      drawRailTile(ctx as OffscreenCanvasRenderingContext2D, paths, tx, ty, 0, 0);
      tiles++;
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const expected = railPixel(paths, tx * 16 + x, ty * 16 + y);
          if (expected) colored++;
          expect(pixels.get(`${x},${y}`), `${tx * 16 + x},${ty * 16 + y}`).toBe(expected);
        }
    }
  expect(tiles).toBeGreaterThan(100);
  expect(colored).toBeGreaterThan(1000);
});

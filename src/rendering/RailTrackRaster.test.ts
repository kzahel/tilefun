import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { nearestRail, railAlignment } from "../railway/RailPath.js";
import { curvedTrainRecipe } from "../scenarios/CurvedTrainRecipe.js";
import { drawRailTile, railPixel } from "./RailTrackRaster.js";

it("aligns pixel rails/sleepers on straights and arcs at positive and negative chunk seams", () => {
  const path = required(curvedTrainRecipe().railways?.[0]?.path),
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

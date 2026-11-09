import { expect, it } from "vitest";
import {
  clipErrors,
  difference,
  fadeError,
  fillError,
  histogram,
  paletteCounts,
} from "./RendererLabChecks.js";

/** A width×height RGBA frame filled with one color, then painted per pixel. */
function frame(width: number, height: number, fill: number[]) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) pixels.set(fill, i);
  return {
    pixels,
    set(x: number, y: number, color: number[]) {
      pixels.set(color, (y * width + x) * 4);
      return this;
    },
  };
}
const CLEAR = [0x24, 0x32, 0x45, 255];
const RED = [250, 20, 20, 255];

it("counts palette colors within tolerance and locates them, so mirroring fails", () => {
  const left = frame(4, 2, CLEAR).set(0, 1, RED).set(1, 1, [252, 18, 21, 255]);
  const right = frame(4, 2, CLEAR).set(3, 1, RED).set(2, 1, RED);
  const colors = ["#243245", "#fa1414"];
  const a = paletteCounts(left.pixels, 4, colors);
  const b = paletteCounts(right.pixels, 4, colors);
  expect(a).toEqual({
    counts: [6, 2],
    bounds: [
      [0, 0, 3, 1],
      [0, 1, 1, 1],
    ],
    other: 0,
  });
  expect(b.counts).toEqual(a.counts);
  expect(b.bounds[1]).toEqual([2, 1, 3, 1]);
  // Three levels off is another color.
  expect(paletteCounts(frame(1, 1, [253, 20, 20, 255]).pixels, 1, colors).other).toBe(1);
  expect(histogram(left.pixels)).toEqual({ "#243245ff": 6, "#fa1414ff": 1, "#fc1215ff": 1 });
});

it("checks clips against the union of rectangles, not their intersection", () => {
  const unclipped = frame(4, 1, RED).pixels;
  const rects = [
    { x: 0, y: 0, width: 1, height: 1 },
    { x: 2, y: 0, width: 1, height: 1 },
  ];
  const good = frame(4, 1, CLEAR).set(0, 0, RED).set(2, 0, RED).pixels;
  expect(clipErrors(good, unclipped, 4, rects, "#243245")).toEqual({
    errors: 0,
    outsideContent: 2,
  });
  // Drawing only the intersection (nothing), or past the union, fails.
  expect(clipErrors(frame(4, 1, CLEAR).pixels, unclipped, 4, rects, "#243245").errors).toBe(2);
  expect(clipErrors(unclipped, unclipped, 4, rects, "#243245").errors).toBe(2);
});

it("accepts a linear fade, including translucent texels, and rejects a wrong alpha", () => {
  const none = frame(1, 1, [100, 100, 100, 255]).pixels;
  // A 40% opaque texel at full detail: 0.4 × 200 + 0.6 × 100 = 140.
  const full = frame(1, 1, [140, 140, 140, 255]).pixels;
  // At LOD alpha 0.5 the texel contributes 0.2: 0.2 × 200 + 0.8 × 100 = 120.
  expect(fadeError(frame(1, 1, [120, 120, 120, 255]).pixels, full, none, 0.5)).toBe(0);
  expect(fadeError(frame(1, 1, [130, 130, 130, 255]).pixels, full, none, 0.5)).toBe(10);
});

it("measures darkening only, with its centroid and changes outside bounds", () => {
  const base = frame(4, 4, [200, 200, 200, 255]).pixels;
  const shadowed = frame(4, 4, [200, 200, 200, 255])
    .set(1, 1, [150, 150, 150, 255])
    .set(2, 1, [150, 150, 150, 255])
    .set(3, 3, [255, 255, 255, 255]).pixels;
  const result = difference(shadowed, base, 4, { x: 0, y: 0, width: 3, height: 3 });
  // Brightening changes a pixel but adds no darkening mass.
  expect(result).toEqual({ outside: 1, mass: 300, x: 2, y: 1.5 });
});

it("compares a filled area with its alpha blend over the base", () => {
  const base = frame(2, 2, [0, 0, 0, 255]).pixels;
  const blended = frame(2, 2, [0x17 * 0.7, 0x5c * 0.7, 0x55 * 0.7, 255]).pixels;
  const rect = { x: 0, y: 0, width: 2, height: 2 };
  expect(fillError(blended, base, 2, rect, "#175c55", 0.7)).toBeLessThanOrEqual(0.5);
  expect(fillError(base, base, 2, rect, "#175c55", 0.7)).toBeCloseTo(0x5c * 0.7);
});

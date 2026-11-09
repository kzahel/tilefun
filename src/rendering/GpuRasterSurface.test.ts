import { expect, it } from "vitest";
import { disjointRects } from "./GpuRasterSurface.js";
import { rasterRevision, touchRaster } from "./RasterSurface.js";

it("unions overlapping clips without blending translucent overlap twice", () => {
  const rects = disjointRects([
    { x: 0, y: 0, width: 4, height: 4 },
    { x: 2, y: 2, width: 4, height: 4 },
  ]);
  for (let y = 0; y < 6; y++)
    for (let x = 0; x < 6; x++) {
      const count = rects.filter(
        (r) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height,
      ).length;
      expect(count).toBe((x < 4 && y < 4) || (x >= 2 && y >= 2) ? 1 : 0);
    }
  expect(
    disjointRects([{ x: 0, y: 0, width: 4, height: 4 }], [{ x: 2, y: 2, width: 4, height: 4 }]),
  ).toEqual([{ x: 2, y: 2, width: 2, height: 2 }]);
});
it("snaps fractional clip edges so strips sharing an edge cover each pixel once", () => {
  // Explorer chunk clips at a fractional zoom: 43.2 px chunks plus a 1 px overlap.
  const chunk = 43.2;
  const rects = disjointRects(
    [0, 1, 2].map((i) => ({ x: 10.4 + i * chunk, y: 5.6, width: chunk + 1, height: chunk + 1 })),
  );
  for (const r of rects)
    for (const value of [r.x, r.y, r.width, r.height]) expect(Number.isInteger(value)).toBe(true);
  const right = 10.4 + 3 * chunk + 1;
  for (let x = 0; x < 160; x++) {
    const count = rects.filter((r) => x >= r.x && x < r.x + r.width).length;
    expect(count, `column ${x}`).toBe(x + 0.5 >= 10.4 && x + 0.5 < right ? 1 : 0);
  }
});
it("versions in-place raster updates independently of object identity", () => {
  const source = {};
  expect(rasterRevision(source)).toBe(0);
  touchRaster(source);
  touchRaster(source);
  expect(rasterRevision(source)).toBe(2);
  expect(rasterRevision({})).toBe(0);
});

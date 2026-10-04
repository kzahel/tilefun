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
it("versions in-place raster updates independently of object identity", () => {
  const source = {};
  expect(rasterRevision(source)).toBe(0);
  touchRaster(source);
  touchRaster(source);
  expect(rasterRevision(source)).toBe(2);
  expect(rasterRevision({})).toBe(0);
});

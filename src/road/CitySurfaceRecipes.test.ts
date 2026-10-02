import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
// @ts-expect-error pngjs has no bundled declarations
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import {
  ALL_CITY_SURFACE_CASES,
  CITY_GEOMETRY_CASES,
  CITY_SURFACE_CASES,
  CITY_SURFACE_SOURCE,
  cityGeometryPlan,
  citySurfaceRoadAt,
  citySurfaceTileAt,
  composeCitySurface,
  SURFACE_COLS,
  SURFACE_ROWS,
} from "./CitySurfaceRecipes.js";

const bytes = readFileSync("public/assets/tilesets/me-complete.png");
const image = PNG.sync.read(bytes);
describe("shared candidate city surfaces", () => {
  it("reserves an unpainted connected refuge and parking spaces away from the crossing", () => {
    const refuge = required(CITY_GEOMETRY_CASES.find((c) => c.geometry === "refuge"));
    const landing = required(cityGeometryPlan(refuge).refuge);
    const pieces = composeCitySurface(refuge);
    expect(pieces.filter((p) => p.label === "Open refuge landing")).toHaveLength(4);
    for (const p of pieces.filter((p) => p.role === "paint")) {
      const [, , w, h] = p.rect;
      expect(
        p.x < landing.maxX &&
          p.x + w > landing.minX &&
          p.y < landing.maxY &&
          p.y + h > landing.minY,
      ).toBe(false);
    }
    const parking = cityGeometryPlan(
      required(CITY_GEOMETRY_CASES.find((c) => c.geometry === "parking")),
    );
    expect(parking.parking).toHaveLength(3);
    for (const bay of parking.parking) {
      expect(bay.maxX - bay.minX).toBe(80);
      expect(bay.maxY - bay.minY).toBe(32);
      for (const crossing of parking.crossings)
        expect(bay.maxX <= crossing.x || bay.minX >= crossing.x + crossing.width).toBe(true);
    }
  });
  it("pins both annotated banks and selects opaque source art within them", () => {
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(CITY_SURFACE_SOURCE.fingerprint);
    const checked = new Set<string>();
    for (const c of ALL_CITY_SURFACE_CASES)
      for (const p of composeCitySurface(c)) {
        const [x, y, w, h] = p.rect,
          key = p.rect.join(",");
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x + w).toBeLessThanOrEqual(image.width);
        expect(y + h).toBeLessThanOrEqual(image.height);
        if (checked.has(key)) continue;
        checked.add(key);
        for (let py = y; py < y + h; py++)
          for (let px = x; px < x + w; px++)
            expect(image.data[(py * image.width + px) * 4 + 3], `${c.id} ${key} ${px},${py}`).toBe(
              255,
            );
      }
  });
  it("covers the canvas exactly once before paint and keeps all paint on road", () => {
    for (const c of ALL_CITY_SURFACE_CASES) {
      const pieces = composeCitySurface(c),
        base = pieces.filter((p) => !["paint", "median"].includes(p.role));
      expect(base).toHaveLength(SURFACE_COLS * SURFACE_ROWS);
      expect(new Set(base.map((p) => `${p.x},${p.y}`)).size).toBe(base.length);
      for (const p of pieces.filter((p) => ["paint", "median"].includes(p.role))) {
        const [, , w, h] = p.rect;
        for (let y = Math.floor(p.y / 16); y < Math.ceil((p.y + h) / 16); y++)
          for (let x = Math.floor(p.x / 16); x < Math.ceil((p.x + w) / 16); x++)
            expect(citySurfaceRoadAt(c, x, y), `${c.id}: ${p.label} at ${x},${y}`).toBe(true);
      }
    }
  });
  it("uses the same neighbor query and source selection when a street spans chunk boundaries", () => {
    const road = (x: number, y: number) => (y >= -3 && y < 3) || (x >= 14 && x < 22);
    const whole = Array.from({ length: 64 }, (_, i) =>
      citySurfaceTileAt("neutral", i - 16, 2, road),
    );
    const chunks = [-16, 0, 16, 32].flatMap((start) =>
      Array.from({ length: 16 }, (_, i) => citySurfaceTileAt("neutral", start + i, 2, road)),
    );
    expect(chunks).toEqual(whole);
    expect(citySurfaceTileAt("neutral", -1, -4, road).rect[0]).toBe(112);
    expect(citySurfaceTileAt("neutral", -1, -4, road).role).toBe("pavement");
  });
  it("continues straight curbs across view boundaries and shades every junction corner", () => {
    const straight = required(CITY_SURFACE_CASES[1]);
    const base = composeCitySurface(straight).filter((p) => p.role === "curb");
    expect(base.filter((p) => p.y === 8 * 16)).toHaveLength(SURFACE_COLS);
    expect(base.filter((p) => p.y === 15 * 16)).toHaveLength(SURFACE_COLS);
    expect(base.find((p) => p.x === 0 && p.y === 8 * 16)?.rect).toEqual(
      base.find((p) => p.x === 31 * 16 && p.y === 8 * 16)?.rect,
    );
    const corner = composeCitySurface(required(CITY_SURFACE_CASES[4]));
    expect(corner.find((p) => p.x === 18 * 16 && p.y === 9 * 16)?.rect).toEqual([
      112, 1904, 16, 16,
    ]);
    const cross = composeCitySurface(required(CITY_SURFACE_CASES[6]));
    for (const [x, y, rect] of [
      [12, 8, [64, 1952, 16, 16]],
      [19, 8, [16, 1952, 16, 16]],
      [12, 15, [64, 1904, 16, 16]],
      [19, 15, [16, 1904, 16, 16]],
    ] as const)
      expect(cross.find((p) => p.x === x * 16 && p.y === y * 16)?.rect).toEqual(rect);
  });
});

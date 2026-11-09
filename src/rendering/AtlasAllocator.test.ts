import { expect, it } from "vitest";
import { AtlasAllocator, type AtlasRegion } from "./AtlasAllocator.js";

function overlaps(a: AtlasRegion, b: AtlasRegion) {
  return (
    a.layer === b.layer &&
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

it("packs terrain-sized pages sixteen to a layer and refuses when full", () => {
  const atlas = new AtlasAllocator(1024, 2);
  const regions = Array.from({ length: 32 }, () => atlas.allocate(256, 256));
  expect(regions.every(Boolean)).toBe(true);
  expect(regions.filter((r) => r?.layer === 0)).toHaveLength(16);
  expect(atlas.allocate(256, 256)).toBeNull();
  expect(atlas.allocate(1025, 1)).toBeNull();
});

it("never overlaps mixed sizes and stays inside the layer", () => {
  const atlas = new AtlasAllocator(1024, 4);
  const sizes = [
    [1024, 192],
    [96, 128],
    [9, 5],
    [1024, 640],
    [256, 256],
    [736, 128],
    [48, 64],
    [1024, 1024],
    [44, 60],
  ];
  const regions: AtlasRegion[] = [];
  for (let i = 0; i < 40; i++) {
    const [w = 1, h = 1] = sizes[i % sizes.length] ?? [];
    const region = atlas.allocate(w, h);
    if (region) regions.push(region);
  }
  expect(regions.length).toBeGreaterThan(20);
  for (const r of regions) {
    expect(r.x + r.width).toBeLessThanOrEqual(1024);
    expect(r.y + r.height).toBeLessThanOrEqual(1024);
    for (const other of regions) if (other !== r) expect(overlaps(r, other)).toBe(false);
  }
});

it("merges freed space back into whole layers so the array can shrink", () => {
  const atlas = new AtlasAllocator(1024, 3);
  const pages = Array.from({ length: 40 }, (_, i) => atlas.allocate(256, i % 2 ? 256 : 100));
  expect(atlas.highestUsedLayer()).toBe(1);
  for (const page of pages.slice(8)) if (page) atlas.free(page);
  // The first eight pages sit in layer 0; everything above it is whole again.
  expect(atlas.highestUsedLayer()).toBe(0);
  atlas.resize(1);
  expect(atlas.layers).toBe(1);
  for (const page of pages.slice(0, 8)) if (page) atlas.free(page);
  expect(atlas.highestUsedLayer()).toBe(-1);
  expect(atlas.allocate(1024, 1024)).toMatchObject({ layer: 0, x: 0, y: 0 });
});

it("reuses a freed span in a partly used shelf", () => {
  const atlas = new AtlasAllocator(1024, 1);
  const a = atlas.allocate(400, 20);
  const b = atlas.allocate(400, 20);
  if (!a || !b) throw Error("allocation failed");
  atlas.free(a);
  expect(atlas.allocate(300, 30)).toMatchObject({ x: 0, y: a.y });
  expect(atlas.allocate(200, 30)).toMatchObject({ x: 800, y: a.y });
});

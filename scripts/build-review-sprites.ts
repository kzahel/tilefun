/** Repack source sprites only. No generated rooms or fingerprints are stored. */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
// pngjs is also used by the main atlas builder.
// @ts-expect-error pngjs has no bundled declarations
import pngjs from "pngjs";
import { buildLayeredApartmentPlan } from "../src/interiors/ApartmentArchitecture.js";
import { parseFloorPlan } from "../src/interiors/ApartmentFloorPlan.js";
import { buildProfileApartmentPlan } from "../src/interiors/ApartmentWallProfiles.js";
import { reviewCases } from "../src/interiors/review/ReviewCases.js";

const { PNG } = pngjs;
const root = fileURLToPath(new URL("../", import.meta.url));
const index = JSON.parse(fs.readFileSync(`${root}public/data/modern-interiors-atlas.json`, "utf8"));
type Entry = { key: string; rect: [number, number, number, number] };
const byKey = new Map<string, Entry>(index.entries.map((e: Entry) => [e.key, e]));
const sizes = new Map<string, { width: number; height: number }>();
function use(key: string, width?: number, height?: number) {
  const entry = byKey.get(key);
  if (!entry) throw new Error(`Missing source sprite ${key}`);
  const old = sizes.get(key);
  sizes.set(key, {
    width: Math.max(old?.width ?? 0, width ?? entry.rect[2]),
    height: Math.max(old?.height ?? 0, height ?? entry.rect[3]),
  });
}
use("room-builder/3d-walls/c08-r01", 1, 1);
for (const c of reviewCases()) {
  const plan = parseFloorPlan(c.sketch);
  const map = c.profiles
    ? buildProfileApartmentPlan(plan, c.profiles)
    : buildLayeredApartmentPlan(plan);
  for (const row of map.cells)
    for (const cell of row)
      for (const layer of [cell.floor, cell.wall, cell.foreground, cell.objects])
        for (const tile of layer)
          use(
            tile.key,
            tile.cropWidth === undefined ? undefined : (tile.cropX ?? 0) + tile.cropWidth,
            tile.cropHeight,
          );
  for (const surface of map.surfaces ?? [])
    use(surface.key, surface.sampleX + 1, surface.sampleY + 1);
}
const entries: Entry[] = index.entries
  .filter((e: Entry) => sizes.has(e.key))
  .map((e: Entry) => {
    const size = sizes.get(e.key);
    if (!size) throw new Error("Missing sprite size");
    return { ...e, rect: [e.rect[0], e.rect[1], size.width, size.height] };
  });
const source = PNG.sync.read(
  fs.readFileSync(`${root}public/assets/tilesets/modern-interiors-atlas.png`),
);
const width = Math.max(256, ...entries.map((e) => e.rect[2]));
let x = 0,
  y = 0,
  rowHeight = 0;
const packed = entries.map((e) => {
  const [, , w, h] = e.rect;
  if (x + w > width) {
    x = 0;
    y += rowHeight;
    rowHeight = 0;
  }
  const rect = [x, y, w, h];
  x += w;
  rowHeight = Math.max(rowHeight, h);
  return { ...e, rect };
});
const height = y + rowHeight;
const output = new PNG({ width, height });
for (const [i, e] of entries.entries()) {
  const dest = packed[i];
  if (!dest) throw new Error("Missing packed sprite");
  PNG.bitblt(source, output, ...e.rect, dest.rect[0], dest.rect[1]);
}
const dir = `${root}src/interiors/review/assets`;
const files = new Map([
  ["review-sprites.png", PNG.sync.write(output) as Buffer],
  [
    "review-sprites.json",
    Buffer.from(
      JSON.stringify({
        ...index,
        atlas: "review-sprites.png",
        atlasWidth: width,
        atlasHeight: height,
        entryCount: packed.length,
        entries: packed,
      }),
    ),
  ],
]);
for (const [name, data] of files) {
  const path = `${dir}/${name}`;
  if (process.argv.includes("--check")) {
    const existing = fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0);
    const normalized =
      name.endsWith(".json") && existing.length
        ? Buffer.from(JSON.stringify(JSON.parse(existing.toString())))
        : existing;
    if (!data.equals(normalized))
      throw new Error("Review sprites are stale. Run npm run assets:review.");
  } else {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path, data);
  }
}
console.log(`${packed.length} sprites, ${width}×${height}; no room renders cached`);

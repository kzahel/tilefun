#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pngjs from "pngjs";

const { PNG } = pngjs;

const TILE_SIZE = 16;
const ATLAS_WIDTH = 2048;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const interiorsRoot = path.join(repoRoot, "assets", "interiors", "1_Interiors", "16x16");
const homeDesignRoot = path.join(repoRoot, "assets", "interiors", "6_Home_Designs");
const outAtlasPath = path.join(
  repoRoot,
  "public",
  "assets",
  "tilesets",
  "modern-interiors-atlas.png",
);
const outIndexPath = path.join(repoRoot, "public", "data", "modern-interiors-atlas.json");

const singleSets = [
  { variant: "normal", dir: "Theme_Sorter_Singles" },
  { variant: "shadowless", dir: "Theme_Sorter_Shadowless_Singles" },
  { variant: "black-shadow", dir: "Theme_Sorter_Black_Shadow_Singles" },
];

function readPng(filePath) {
  return PNG.sync.read(fs.readFileSync(filePath));
}

function writePng(filePath, png) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, PNG.sync.write(png));
}

function walkPngs(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const result = [];
  for (const ent of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const full = path.join(rootDir, ent.name);
    if (ent.isDirectory()) {
      result.push(...walkPngs(full));
    } else if (ent.isFile() && ent.name.toLowerCase().endsWith(".png")) {
      result.push(full);
    }
  }
  return result.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function relToRepo(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

function slug(input) {
  return input
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function stripThemeNoise(input) {
  return input
    .replace(/^\d+[-_]?/, "")
    .replace(/_?Black_Shadow_?Singles_?16x16$/i, "")
    .replace(/_?Singles_?Shadowless$/i, "")
    .replace(/_?Singles$/i, "")
    .replace(/_?Shadowless$/i, "")
    .replace(/_?16x16$/i, "");
}

function inferThemeFromSingleDir(dirName) {
  return slug(stripThemeNoise(dirName));
}

function roomBuilderGroup(fileName) {
  return slug(fileName.replace(/^Room_Builder_/, "").replace(/_16x16\.png$/i, ""));
}

function hasAnyAlpha(png, x, y, width, height) {
  const maxY = Math.min(y + height, png.height);
  const maxX = Math.min(x + width, png.width);
  for (let py = y; py < maxY; py++) {
    for (let px = x; px < maxX; px++) {
      if (png.data[(py * png.width + px) * 4 + 3] !== 0) return true;
    }
  }
  return false;
}

function copyRegion(src, dest, srcX, srcY, width, height, destX, destY) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = ((srcY + y) * src.width + (srcX + x)) * 4;
      const destIdx = ((destY + y) * dest.width + (destX + x)) * 4;
      dest.data[destIdx] = src.data[srcIdx];
      dest.data[destIdx + 1] = src.data[srcIdx + 1];
      dest.data[destIdx + 2] = src.data[srcIdx + 2];
      dest.data[destIdx + 3] = src.data[srcIdx + 3];
    }
  }
}

function addEntry(entries, keyCounts, entry) {
  const baseKey = entry.key;
  const count = keyCounts.get(baseKey) ?? 0;
  keyCounts.set(baseKey, count + 1);
  entries.push(count === 0 ? entry : { ...entry, key: `${baseKey}-${count + 1}` });
}

function collectSingleEntries(keyCounts) {
  const entries = [];
  for (const set of singleSets) {
    const root = path.join(interiorsRoot, set.dir);
    for (const filePath of walkPngs(root)) {
      const png = readPng(filePath);
      const themeDir = path.basename(path.dirname(filePath));
      const theme = inferThemeFromSingleDir(themeDir);
      const stem = path.basename(filePath, ".png");
      addEntry(entries, keyCounts, {
        key: `single/${set.variant}/${theme}/${slug(stem)}`,
        sourceKind: "single",
        sourcePath: relToRepo(filePath),
        sourceRect: [0, 0, png.width, png.height],
        variant: set.variant,
        theme,
        category: "object",
        tags: [theme, "object"],
        image: png,
        w: png.width,
        h: png.height,
      });
    }
  }
  return entries;
}

function collectRoomBuilderEntries(keyCounts) {
  const entries = [];
  const root = path.join(interiorsRoot, "Room_Builder_subfiles");
  for (const filePath of walkPngs(root)) {
    const png = readPng(filePath);
    const group = roomBuilderGroup(path.basename(filePath));
    addEntry(entries, keyCounts, {
      key: `room-builder-sheet/${group}`,
      sourceKind: "room_builder_sheet",
      sourcePath: relToRepo(filePath),
      sourceRect: [0, 0, png.width, png.height],
      theme: "room-builder",
      category: group,
      tags: ["room-builder", group, "architecture"],
      image: png,
      w: png.width,
      h: png.height,
    });

    const cols = Math.floor(png.width / TILE_SIZE);
    const rows = Math.floor(png.height / TILE_SIZE);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * TILE_SIZE;
        const y = row * TILE_SIZE;
        if (!hasAnyAlpha(png, x, y, TILE_SIZE, TILE_SIZE)) continue;
        const tile = new PNG({ width: TILE_SIZE, height: TILE_SIZE });
        copyRegion(png, tile, x, y, TILE_SIZE, TILE_SIZE, 0, 0);
        addEntry(entries, keyCounts, {
          key: `room-builder/${group}/c${String(col).padStart(2, "0")}-r${String(row).padStart(
            2,
            "0",
          )}`,
          sourceKind: "room_builder_tile",
          sourcePath: relToRepo(filePath),
          sourceRect: [x, y, TILE_SIZE, TILE_SIZE],
          theme: "room-builder",
          category: group,
          tags: ["room-builder", group, "architecture"],
          image: tile,
          w: TILE_SIZE,
          h: TILE_SIZE,
        });
      }
    }
  }
  return entries;
}

function homeDesignName(filePath) {
  const rel = path.relative(homeDesignRoot, filePath).split(path.sep);
  const family = rel[0] ?? "home-design";
  const stem = path.basename(filePath, ".png");
  const design = stem
    .replace(/_?preview_?16x16$/i, "")
    .replace(/_?preview$/i, "")
    .replace(/_?layer_?\d+_?16x16$/i, "")
    .replace(/_?Layer_?\d+_?16x16$/i, "")
    .replace(/_?layer_?\d+_?$/i, "")
    .replace(/_?Layer_?\d+_?$/i, "");
  return `${slug(family)}/${slug(design)}`;
}

function homeDesignLayer(filePath) {
  const stem = path.basename(filePath, ".png");
  const layerMatch = stem.match(/layer_?(\d+)/i);
  if (layerMatch?.[1]) return `layer-${layerMatch[1]}`;
  if (/preview/i.test(stem)) return "preview";
  return slug(stem);
}

function collectHomeDesignEntries(keyCounts) {
  const entries = [];
  for (const filePath of walkPngs(homeDesignRoot).filter((p) =>
    p.includes(`${path.sep}16x16${path.sep}`),
  )) {
    const png = readPng(filePath);
    const design = homeDesignName(filePath);
    const layer = homeDesignLayer(filePath);
    addEntry(entries, keyCounts, {
      key: `home-design/${design}/${layer}`,
      sourceKind: "home_design_layer",
      sourcePath: relToRepo(filePath),
      sourceRect: [0, 0, png.width, png.height],
      theme: "home-design",
      category: layer === "preview" ? "preview" : "prefab-layer",
      design,
      layer,
      tags: ["home-design", design, layer],
      image: png,
      w: png.width,
      h: png.height,
    });
  }
  return entries;
}

function pack(entries) {
  const sorted = [...entries].sort((a, b) => {
    const heightDelta = b.h - a.h;
    if (heightDelta !== 0) return heightDelta;
    const widthDelta = b.w - a.w;
    if (widthDelta !== 0) return widthDelta;
    return a.key.localeCompare(b.key, undefined, { numeric: true });
  });

  let x = 0;
  let y = 0;
  let shelfHeight = 0;
  for (const entry of sorted) {
    if (entry.w > ATLAS_WIDTH) {
      throw new Error(`Entry ${entry.key} is wider than atlas width ${ATLAS_WIDTH}`);
    }
    if (x + entry.w > ATLAS_WIDTH) {
      x = 0;
      y += shelfHeight;
      shelfHeight = 0;
    }
    entry.atlasX = x;
    entry.atlasY = y;
    x += entry.w;
    shelfHeight = Math.max(shelfHeight, entry.h);
  }
  const usedHeight = y + shelfHeight;
  const atlasHeight = Math.max(TILE_SIZE, Math.ceil(usedHeight / TILE_SIZE) * TILE_SIZE);
  const atlas = new PNG({ width: ATLAS_WIDTH, height: atlasHeight });
  for (const entry of sorted) {
    copyRegion(entry.image, atlas, 0, 0, entry.w, entry.h, entry.atlasX, entry.atlasY);
  }
  return { atlas, entries: sorted };
}

function toIndexEntry(entry) {
  const {
    image: _image,
    w,
    h,
    atlasX,
    atlasY,
    key,
    sourceKind,
    sourcePath,
    sourceRect,
    variant,
    theme,
    category,
    design,
    layer,
    tags,
  } = entry;
  return {
    key,
    rect: [atlasX, atlasY, w, h],
    sourceKind,
    sourcePath,
    sourceRect,
    ...(variant ? { variant } : {}),
    theme,
    category,
    ...(design ? { design } : {}),
    ...(layer ? { layer } : {}),
    tags,
  };
}

function main() {
  if (!fs.existsSync(interiorsRoot)) {
    throw new Error(`Modern Interiors source directory not found: ${interiorsRoot}`);
  }

  const keyCounts = new Map();
  const entries = [
    ...collectRoomBuilderEntries(keyCounts),
    ...collectSingleEntries(keyCounts),
    ...collectHomeDesignEntries(keyCounts),
  ];
  const { atlas, entries: packedEntries } = pack(entries);
  writePng(outAtlasPath, atlas);

  const indexEntries = packedEntries
    .map(toIndexEntry)
    .sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
  const summary = indexEntries.reduce(
    (acc, entry) => {
      acc.sourceKinds[entry.sourceKind] = (acc.sourceKinds[entry.sourceKind] ?? 0) + 1;
      acc.categories[entry.category] = (acc.categories[entry.category] ?? 0) + 1;
      if (entry.variant) acc.variants[entry.variant] = (acc.variants[entry.variant] ?? 0) + 1;
      return acc;
    },
    { sourceKinds: {}, categories: {}, variants: {} },
  );

  const index = {
    version: 1,
    atlas: "assets/tilesets/modern-interiors-atlas.png",
    tileSize: TILE_SIZE,
    atlasWidth: atlas.width,
    atlasHeight: atlas.height,
    entryCount: indexEntries.length,
    summary,
    entries: indexEntries,
  };
  const pretty = process.argv.includes("--pretty");

  fs.mkdirSync(path.dirname(outIndexPath), { recursive: true });
  fs.writeFileSync(outIndexPath, `${JSON.stringify(index, null, pretty ? 2 : undefined)}\n`);

  console.log(
    `Wrote ${relToRepo(outAtlasPath)} (${atlas.width}x${atlas.height}) and ${relToRepo(
      outIndexPath,
    )} with ${indexEntries.length} entries.`,
  );
}

main();

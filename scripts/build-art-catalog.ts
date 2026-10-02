import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, sep } from "node:path";
import {
  type ArtCatalog,
  type ArtRect,
  type ArtSheet,
  type ArtUsage,
  required,
  validateRect,
} from "../src/art/ArtCatalog.js";
import { registerTileVariants, SPRITE_MANIFEST } from "../src/assets/GameAssets.js";
import { BlendGraph } from "../src/autotile/BlendGraph.js";
import { ALL_TERRAIN_IDS, TerrainId } from "../src/autotile/TerrainId.js";
import { getPropSourceDefinitions } from "../src/entities/PropFactories.js";
import { BUILDING_RECIPES } from "../src/generation/regional/BuildingRecipes.js";
import { CITY_BUILDING_PREFABS } from "../src/generation/regional/CityBuildingPrefabs.js";
import {
  COMMERCIAL_STREET_PROPS,
  COMMERCIAL_SURFACE_CELLS,
} from "../src/generation/regional/CommercialCityAssets.js";
import { DENSE_CITY_BUILDINGS } from "../src/generation/regional/DenseCityAssets.js";
import { STREET_REVIEW_SCENES } from "../src/generation/regional/StreetRecipes.js";
import { FURNITURE_CATALOG } from "../src/interiors/FurnitureCatalog.js";
import {
  CITY_GEOMETRY_CASES,
  CITY_SURFACE_CASES,
  composeCitySurface,
} from "../src/road/CitySurfaceRecipes.js";
import { denseCitySurfacePieces } from "../src/road/DenseCitySurface.js";
import { getRoadSheetKey, RoadType } from "../src/road/RoadType.js";
import { composeStreetStarterSurface } from "../src/road/StreetStarterSurface.js";
import { getTileDef, registerDefaultTiles, TileId } from "../src/world/TileRegistry.js";

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? files(join(dir, entry.name))
        : [join(dir, entry.name).split(sep).join("/")],
    )
    .sort();
}
const references = new Map<string, { system: string; source: string }[]>();
for (const path of files("src").filter(
  (p) => p.endsWith(".ts") && !p.endsWith(".test.ts") && !p.startsWith("src/art/"),
)) {
  const source = readFileSync(path, "utf8");
  // Conservative lexical references: skip comments/templates; only literal tokens count.
  // Dynamic architecture selectors are explicitly a coverage gap, never "unused".
  let i = 0;
  while (i < source.length) {
    if (source.startsWith("//", i)) {
      i = source.indexOf("\n", i);
      if (i < 0) break;
      continue;
    }
    if (source.startsWith("/*", i)) {
      const end = source.indexOf("*/", i + 2);
      i = end < 0 ? source.length : end + 2;
      continue;
    }
    const quote = source[i];
    if (quote !== '"' && quote !== "'" && quote !== "`") {
      i++;
      continue;
    }
    const start = i++;
    let value = "";
    while (i < source.length && source[i] !== quote) {
      if (source[i] === "\\") {
        value += source[i + 1] ?? "";
        i += 2;
      } else value += source[i++];
    }
    i++;
    if (quote === "`") continue;
    const line = source.slice(0, start).split("\n").length;
    const system = path.endsWith("/StreetRecipes.ts")
      ? "Street starter review (candidate)"
      : path.startsWith("src/generation/")
        ? "World generation"
        : path.startsWith("src/interiors/")
          ? "Interiors"
          : path.startsWith("src/editor/") || path.startsWith("src/scenes/")
            ? "Editor"
            : "Gameplay";
    const refs = references.get(value) ?? [];
    refs.push({ system, source: `${path}:${line}` });
    references.set(value, refs);
  }
}
const graph = new BlendGraph();
const imageMap = new Map<string, string>([
  ["me-complete", "assets/tilesets/me-complete.png"],
  ["modern-interiors", "assets/tilesets/modern-interiors-atlas.png"],
  ["objects", "assets/tilesets/objects.png"],
  ["grass", "assets/tilesets/grass.png"],
  ["dirt", "assets/tilesets/dirt.png"],
  ["water", "assets/tilesets/water.png"],
  ...graph.allSheets.map((s) => [s.sheetKey, s.assetPath] as [string, string]),
  ...SPRITE_MANIFEST.map((s) => [s.key, s.path] as [string, string]),
]);
// Browse every extracted autotile, including those not currently registered with BlendGraph.
for (const path of files("public/assets/tilesets").filter((p) => /me-autotile-\d+\.png$/.test(p))) {
  const id = `me${basename(path).match(/\d+/)?.[0]}`;
  if (!imageMap.has(id)) imageMap.set(id, path.replace(/^public\//, ""));
}
const sheets: ArtSheet[] = [...imageMap].map(([id, image]) => {
  const bytes = readFileSync(`public/${image}`);
  const sheet: ArtSheet = {
    id,
    name:
      id === "me-complete"
        ? "Modern Exteriors · complete"
        : id === "modern-interiors"
          ? "Modern Interiors · packed atlas"
          : id.startsWith("me")
            ? `Modern Exteriors · autotile ${id.slice(2)}`
            : id.replaceAll("-", " "),
    image,
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    tileSize: 16,
    fingerprint: createHash("sha256").update(bytes).digest("hex"),
    source: "public/assets/SOURCES.md",
  };
  if (id === "me-complete")
    Object.assign(sheet, {
      source: "assets/exteriors/Modern_Exteriors_16x16/Modern_Exteriors_Complete_Tileset.png",
      index: "data/me-atlas-index.json",
      indexKind: "exteriors",
    });
  if (id === "modern-interiors")
    Object.assign(sheet, {
      source: "assets/interiors/ (packed; individual source paths in slice index)",
      index: "data/modern-interiors-atlas.json",
      indexKind: "interiors",
    });
  return sheet;
});
const aliases = new Map([
  ...sheets.map((s) => [s.id, s.id] as [string, string]),
  ["shallowwater", "me03"],
  ["deepwater", "me16"],
]);
const usages: ArtUsage[] = [];
function add(
  id: string,
  sheetId: string,
  rect: ArtRect,
  label: string,
  kind: ArtUsage["kind"],
  consumers: ArtUsage["consumers"],
) {
  const resolved = aliases.get(sheetId);
  const sheet = sheets.find((s) => s.id === resolved);
  if (!sheet) throw new Error(`Unknown sheet ${sheetId}`);
  usages.push({ id, sheetId: sheet.id, rect: validateRect(rect, sheet), label, kind, consumers });
}
for (const def of getPropSourceDefinitions())
  add(`prop:${def.type}`, def.sheetKey, def.rect, def.type, "prop", [
    ...(references.get(def.type) ?? []),
    ...(COMMERCIAL_STREET_PROPS.some((p) => p.type === def.type)
      ? [
          {
            system: "Commercial streets (regional-v6, promoted)",
            source: "src/generation/regional/commercial-city-assets-v1.json",
          },
        ]
      : []),
  ]);
for (const recipe of [...BUILDING_RECIPES, ...CITY_BUILDING_PREFABS, ...DENSE_CITY_BUILDINGS])
  for (const [n, part] of recipe.parts.entries())
    add(
      `recipe:${recipe.type}:${n}`,
      "me-complete",
      [part.frameCol * 16, part.frameRow * 16, part.spriteWidth, part.spriteHeight],
      `${recipe.type} · piece ${n + 1}`,
      "recipe",
      [
        {
          system: recipe.type.startsWith("prop-city-dense-v1-")
            ? "Dense districts (regional-v4, promoted)"
            : recipe.type.startsWith("prop-city-v1-")
              ? "City prefab showcase (candidate)"
              : "Regional district facades",
          source: recipe.type.startsWith("prop-city-dense-v1-")
            ? "src/generation/regional/dense-city-assets-v1.json"
            : recipe.type.startsWith("prop-city-v1-")
              ? "src/generation/regional/CityBuildingPrefabs.ts"
              : "src/generation/regional/BuildingRecipes.ts",
        },
        ...(references.get(recipe.type) ?? []),
      ],
    );
const surfaceTiles = new Map(
  CITY_SURFACE_CASES.flatMap((c) =>
    composeCitySurface(c).map((p) => [p.rect.join(":"), p] as const),
  ),
);
const geometryTiles = new Map(
  CITY_GEOMETRY_CASES.flatMap((c) =>
    composeCitySurface(c).map((p) => [p.rect.join(":"), p] as const),
  ),
);
for (const [key, piece] of geometryTiles)
  add(
    `surface:city-v2:${key}`,
    "me-complete",
    piece.rect,
    `Road geometry candidate · ${piece.label}`,
    "terrain",
    [{ system: "Road geometry review (candidate)", source: "src/road/CitySurfaceRecipes.ts" }],
  );
const streetTiles = new Map(
  STREET_REVIEW_SCENES.flatMap((c) =>
    composeStreetStarterSurface(c.bounds).map((p) => [p.rect.join(":"), p] as const),
  ),
);
for (const [key, piece] of streetTiles)
  add(
    `surface:street-starter-v1:${key}`,
    "me-complete",
    piece.rect,
    `Street starter · ${piece.label}`,
    "terrain",
    [{ system: "Street starter review (candidate)", source: "src/road/StreetStarterSurface.ts" }],
  );
for (const [key, piece] of surfaceTiles)
  add(
    `surface:city-v1:${key}`,
    "me-complete",
    piece.rect,
    `City surface candidate · ${piece.label}`,
    "terrain",
    [{ system: "Road foundation review (candidate)", source: "src/road/CitySurfaceRecipes.ts" }],
  );
// Inventory the exact promoted cell clips, including every audited curb join.
const denseTiles = new Map<string, ReturnType<typeof denseCitySurfacePieces>[number]>();
const neighbors = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];
for (let mask = 0; mask < 256; mask++)
  for (let type = 5; type <= 14; type++)
    for (const p of denseCitySurfacePieces(type, 0, 0, (x, y) => {
      if (!x && !y) return type;
      const i = neighbors.findIndex((p) => p[0] === x && p[1] === y);
      return i >= 0 && mask & (1 << i) ? 5 : 6;
    }))
      denseTiles.set(p.rect.join(":"), p);
for (const [key, p] of denseTiles)
  add(
    `surface:dense-v1:${key}`,
    "me-complete",
    p.rect,
    `Dense city surface v1 · ${p.label}`,
    "terrain",
    [
      { system: "Dense districts (regional-v4, promoted)", source: "src/road/DenseCitySurface.ts" },
      { system: "Game / real-tile preview renderer", source: "src/rendering/TileRenderer.ts" },
    ],
  );
const commercialTiles = new Map(
  COMMERCIAL_SURFACE_CELLS.flatMap((cell) => cell.map((p) => [p.rect.join(":"), p] as const)),
);
for (const [key, p] of commercialTiles)
  add(
    `surface:commercial-v1:${key}`,
    "me-complete",
    p.rect,
    `Commercial street surface · ${p.label}`,
    "terrain",
    [
      {
        system: "Commercial streets (regional-v6, promoted)",
        source: "src/generation/regional/commercial-city-assets-v1.json",
      },
      { system: "Game / real-tile preview renderer", source: "src/rendering/TileRenderer.ts" },
    ],
  );
registerTileVariants({
  addTiles(group, coords) {
    for (const [i, c] of coords.entries())
      add(
        `variant:${group}:${c.col}:${c.row}:${i}`,
        "me-complete",
        [c.col * 16, c.row * 16, 16, 16],
        `${group} fill variant (when enabled)`,
        "terrain",
        [{ system: "Terrain fill variants", source: "src/assets/GameAssets.ts" }],
      );
  },
  addRect(group, col, row, w, h) {
    add(
      `variant-region:${group}:${col}:${row}`,
      "me-complete",
      [col * 16, row * 16, w * 16, h * 16],
      `${group} fill variants (when enabled)`,
      "terrain",
      [{ system: "Terrain fill variants", source: "src/assets/GameAssets.ts" }],
    );
  },
});
for (const sheet of graph.allSheets) {
  const meta = required(sheets.find((s) => s.id === sheet.sheetKey));
  add(
    `blend:${sheet.sheetKey}`,
    sheet.sheetKey,
    [0, 0, meta.width, meta.height],
    "Autotile mask bank · terrain transitions",
    "terrain",
    [{ system: "Terrain blends", source: "src/autotile/BlendGraph.ts" }],
  );
}
for (const type of [RoadType.Sidewalk, RoadType.LineWhite, RoadType.LineYellow]) {
  const key = required(getRoadSheetKey(type));
  const meta = required(sheets.find((s) => s.id === key));
  add(
    `road:${type}`,
    key,
    [0, 0, meta.width, meta.height],
    `${RoadType[type]} road overlay bank`,
    "terrain",
    [{ system: "Road renderer / cardinal autotiler", source: "src/road/RoadType.ts" }],
  );
}
for (const terrain of ALL_TERRAIN_IDS) {
  const fill = graph.getBaseFill(terrain);
  const sheet = fill ? graph.allSheets[fill.sheetIndex] : undefined;
  if (fill && sheet)
    add(
      `fill:${terrain}`,
      sheet.sheetKey,
      [fill.col * 16, fill.row * 16, 16, 16],
      `${TerrainId[terrain]} base fill`,
      "terrain",
      [{ system: "Terrain base fills", source: "src/autotile/BlendGraph.ts" }],
    );
}
registerDefaultTiles();
for (const tileId of Object.values(TileId).filter((id): id is number => typeof id === "number")) {
  const def = getTileDef(tileId);
  // Old registry terrain coords include historically invalid defaults, bypassed by BlendGraph.
  // Only the live detail layer reads these definitions directly.
  if (def && def.sheetKey === "objects")
    add(
      `detail:${tileId}`,
      def.sheetKey,
      [def.spriteCol * 16, def.spriteRow * 16, 16, 16],
      `Detail ${TileId[tileId]} (legacy labels)`,
      "terrain",
      [{ system: "Detail tile layer", source: "src/world/TileRegistry.ts" }],
    );
}
const interiorIndex = JSON.parse(
  readFileSync("public/data/modern-interiors-atlas.json", "utf8"),
) as { entries: { key: string; rect: ArtRect }[] };
const interiors = new Map(interiorIndex.entries.map((entry) => [entry.key, entry.rect]));
for (const def of FURNITURE_CATALOG)
  add(
    `furniture:${def.id}`,
    "modern-interiors",
    required(interiors.get(def.key)),
    def.name,
    "furniture",
    [
      {
        system: "Furniture catalog / workbench / gameplay interiors",
        source: "src/interiors/FurnitureCatalog.ts",
      },
      ...(references.get(def.id) ?? []),
    ],
  );
for (const [key, consumers] of references)
  if (key.startsWith("room-builder/") && interiors.has(key))
    add(
      `architecture:${key}`,
      "modern-interiors",
      required(interiors.get(key)),
      key,
      "architecture",
      consumers,
    );
for (const sprite of SPRITE_MANIFEST) {
  const sheet = required(sheets.find((s) => s.id === sprite.key));
  add(
    `sprite:${sprite.key}`,
    sprite.key,
    [0, 0, sheet.width, sheet.height],
    `${sprite.key} · registered ${sprite.w}×${sprite.h} frames`,
    "sprite",
    [
      { system: "Shared asset loader (registered)", source: "src/assets/GameAssets.ts" },
      ...(references.get(sprite.key) ?? []),
    ],
  );
}
const catalog: ArtCatalog = { version: 1, sheets, usages };
const output = `${JSON.stringify(catalog, null, 2)}\n`;
const destination = "public/data/art-catalog.json";
if (process.argv.includes("--check")) {
  if (JSON.stringify(JSON.parse(readFileSync(destination, "utf8"))) !== JSON.stringify(catalog))
    throw new Error("Art inventory is stale. Run npm run art:catalog.");
} else writeFileSync(destination, output);
console.log(
  `${sheets.length} sheets, ${usages.length} source uses; named slices reuse existing indexes.`,
);

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { type ArtRect, inflateSlices } from "../src/art/ArtCatalog.js";
import {
  inferMetadata,
  type OutdoorAsset,
  type OutdoorCatalog,
  outdoorId,
  parseOutdoorMetadata,
} from "../src/assets/outdoor/OutdoorCatalog.js";
import candidates from "../src/assets/outdoor/outdoor-candidates-v1.json";
import { createProp, getPropSourceDefinitions } from "../src/entities/PropFactories.js";

const { PNG } = createRequire(import.meta.url)("pngjs");
const bytes = readFileSync("public/assets/tilesets/me-complete.png"),
  png = PNG.sync.read(bytes);
const sourceFingerprint = createHash("sha256").update(bytes).digest("hex");
const index = JSON.parse(readFileSync("public/data/me-atlas-index.json", "utf8"));
const slices = inflateSlices(
  {
    id: "me-complete",
    name: "",
    image: "",
    fingerprint: sourceFingerprint,
    source: "",
    tileSize: 16,
    width: png.width,
    height: png.height,
    indexKind: "exteriors",
  },
  index,
);
const map = new Map<string, OutdoorAsset>();
for (const slice of slices) {
  const id = outdoorId(slice.rect);
  let asset = map.get(id);
  if (!asset) {
    const [x, y, w, h] = slice.rect;
    let minX = w,
      minY = h,
      maxX = -1,
      maxY = -1;
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++)
        if (png.data[((y + dy) * png.width + x + dx) * 4 + 3]) {
          minX = Math.min(minX, dx);
          minY = Math.min(minY, dy);
          maxX = Math.max(maxX, dx);
          maxY = Math.max(maxY, dy);
        }
    asset = {
      id,
      rect: slice.rect,
      visualBounds: maxX < 0 ? [0, 0, 1, 1] : [minX, minY, maxX - minX + 1, maxY - minY + 1],
      aliases: [],
      metadata: inferMetadata(slice.name, slice.theme, slice.rect),
      evidence: "inferred",
      runtimeTypes: [],
    };
    map.set(id, asset);
  }
  asset.aliases.push({ key: slice.key, name: slice.name, theme: slice.theme });
}
const definitions = getPropSourceDefinitions().filter((d) => d.sheetKey === "me-complete");
for (const asset of map.values()) {
  const defs = definitions.filter((d) => JSON.stringify(d.rect) === JSON.stringify(asset.rect));
  asset.runtimeTypes = defs.map((d) => d.type);
  // Expose production geometry where a static source rectangle matches exactly.
  // Multiple runtime versions can disagree; the inspector lists all types.
  const preferred = defs.find((d) => d.type.startsWith("prop-city-commercial")) ?? defs[0];
  if (preferred) {
    const p = createProp(preferred.type, 0, 0),
      colliders = p.walls ?? (p.collider ? [p.collider] : []);
    asset.metadata.colliders = colliders;
    if (colliders.length) {
      const l = Math.min(...colliders.map((c) => c.offsetX - c.width / 2)),
        r = Math.max(...colliders.map((c) => c.offsetX + c.width / 2)),
        t = Math.min(...colliders.map((c) => c.offsetY - c.height)),
        b = Math.max(...colliders.map((c) => c.offsetY));
      asset.metadata.footprint = [l, t, r - l, b - t];
    }
    asset.evidence = "runtime";
  }
}
const runtime: { id: string; rect: ArtRect; metadata: OutdoorAsset["metadata"] }[] = [];
for (const c of candidates.candidates) {
  const asset = [...map.values()].find((a) => a.aliases.some((s) => s.key === c.key));
  if (!asset) throw new Error(`Candidate missing: ${c.key}`);
  asset.metadata = parseOutdoorMetadata({ ...asset.metadata, ...c, kind: "prop" }, asset.rect);
  asset.evidence = "candidate";
  runtime.push({ id: asset.id, rect: asset.rect, metadata: asset.metadata });
}
const cols = png.width / 16,
  rows = png.height / 16,
  covered = new Uint8Array(cols * rows);
for (const a of map.values())
  for (let y = Math.floor(a.rect[1] / 16); y < Math.ceil((a.rect[1] + a.rect[3]) / 16); y++)
    for (let x = Math.floor(a.rect[0] / 16); x < Math.ceil((a.rect[0] + a.rect[2]) / 16); x++)
      covered[y * cols + x] = 1;
let occupiedCells = 0,
  indexedCells = 0;
const gaps: ArtRect[] = [];
for (let y = 0; y < rows; y++) {
  let start = -1;
  for (let x = 0; x <= cols; x++) {
    let nonempty = false;
    if (x < cols)
      for (let dy = 0; dy < 16 && !nonempty; dy++)
        for (let dx = 0; dx < 16; dx++)
          if (png.data[((y * 16 + dy) * png.width + x * 16 + dx) * 4 + 3]) {
            nonempty = true;
            break;
          }
    if (nonempty) {
      occupiedCells++;
      if (covered[y * cols + x]) indexedCells++;
    }
    const gap = nonempty && !covered[y * cols + x];
    if (gap && start < 0) start = x;
    if (!gap && start >= 0) {
      gaps.push([start * 16, y * 16, (x - start) * 16, 16]);
      start = -1;
    }
  }
}
const assets = [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
const body = {
  version: 1 as const,
  sourceFingerprint,
  width: png.width,
  height: png.height,
  assets,
  coverage: {
    totalCells: cols * rows,
    occupiedCells,
    indexedCells,
    gapCells: occupiedCells - indexedCells,
    gaps,
    originalMatched: index.matched,
    originalUnmatched: index.unmatched,
  },
};
const catalog: OutdoorCatalog = {
  ...body,
  revision: createHash("sha256").update(JSON.stringify(body)).digest("hex"),
};
const outputs = [
  ["public/data/outdoor-catalog.json", catalog],
  [
    "src/assets/outdoor/outdoor-runtime-v1.json",
    { version: 1, sourceFingerprint, assets: runtime },
  ],
] as const;
for (const [path, value] of outputs) {
  const content = JSON.stringify(value, null, 2) + "\n";
  if (process.argv.includes("--check")) {
    if (readFileSync(path, "utf8") !== content)
      throw new Error(`Stale ${path}; run npm run assets:outdoor`);
  } else writeFileSync(path, content);
}
console.log(
  `${assets.length} distinct rectangles / ${slices.length} aliases. ${indexedCells}/${occupiedCells} occupied cells indexed; ${occupiedCells - indexedCells} explicit gap cells. ${runtime.length} candidate geometry profiles.`,
);

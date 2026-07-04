export const MODERN_INTERIORS_SHEET_KEY = "modern-interiors";
export const MODERN_INTERIORS_ATLAS_PREFIX = "interior:";

export type ModernInteriorsSourceKind =
  | "single"
  | "room_builder_sheet"
  | "room_builder_tile"
  | "home_design_layer";

export type ModernInteriorsVariant = "normal" | "shadowless" | "black-shadow";

export interface ModernInteriorsAtlasEntry {
  key: string;
  rect: [number, number, number, number];
  sourceKind: ModernInteriorsSourceKind;
  sourcePath: string;
  sourceRect: [number, number, number, number];
  variant?: ModernInteriorsVariant;
  theme: string;
  category: string;
  design?: string;
  layer?: string;
  tags: string[];
}

interface ModernInteriorsAtlasSummary {
  sourceKinds: Partial<Record<ModernInteriorsSourceKind, number>>;
  categories: Record<string, number>;
  variants: Partial<Record<ModernInteriorsVariant, number>>;
}

interface ModernInteriorsAtlasIndex {
  version: number;
  atlas: string;
  tileSize: number;
  atlasWidth: number;
  atlasHeight: number;
  entryCount: number;
  summary: ModernInteriorsAtlasSummary;
  entries: ModernInteriorsAtlasEntry[];
}

let _index: ModernInteriorsAtlasIndex | null = null;
let _entriesByKey: Map<string, ModernInteriorsAtlasEntry> | null = null;
let _categories: string[] | null = null;
let _designs: string[] | null = null;

function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function layerRank(layer: string | undefined): number {
  if (!layer) return 0;
  if (layer === "preview") return Number.MAX_SAFE_INTEGER;
  const match = layer.match(/^layer-(\d+)$/);
  return match?.[1] ? Number(match[1]) : 1000;
}

export function compareModernInteriorsLayers(
  a: ModernInteriorsAtlasEntry,
  b: ModernInteriorsAtlasEntry,
): number {
  const rankDelta = layerRank(a.layer) - layerRank(b.layer);
  if (rankDelta !== 0) return rankDelta;
  return a.key.localeCompare(b.key, undefined, { numeric: true });
}

export async function loadModernInteriorsAtlasIndex(): Promise<void> {
  if (_index) return;
  const res = await fetch("data/modern-interiors-atlas.json");
  if (!res.ok) throw new Error(`Failed to load Modern Interiors atlas index: ${res.status}`);
  const index = (await res.json()) as ModernInteriorsAtlasIndex;

  _index = index;
  _entriesByKey = new Map(index.entries.map((entry) => [entry.key, entry]));
  _categories = sortedUnique(index.entries.map((entry) => entry.category));
  _designs = sortedUnique(
    index.entries
      .filter((entry) => entry.sourceKind === "home_design_layer" && entry.design)
      .map((entry) => entry.design as string),
  );
}

export function isModernInteriorsAtlasLoaded(): boolean {
  return _index !== null;
}

export function getModernInteriorsAtlasIndex(): ModernInteriorsAtlasIndex {
  if (!_index) {
    throw new Error(
      "Modern Interiors atlas index not loaded. Call loadModernInteriorsAtlasIndex().",
    );
  }
  return _index;
}

export function getModernInteriorsEntries(): ModernInteriorsAtlasEntry[] {
  return getModernInteriorsAtlasIndex().entries;
}

export function getModernInteriorsEntry(key: string): ModernInteriorsAtlasEntry | undefined {
  if (!_entriesByKey) {
    throw new Error(
      "Modern Interiors atlas index not loaded. Call loadModernInteriorsAtlasIndex().",
    );
  }
  return _entriesByKey.get(key);
}

export function getModernInteriorsCategories(): string[] {
  if (!_categories) {
    throw new Error(
      "Modern Interiors atlas index not loaded. Call loadModernInteriorsAtlasIndex().",
    );
  }
  return _categories;
}

export function getModernInteriorsDesigns(): string[] {
  if (!_designs) {
    throw new Error(
      "Modern Interiors atlas index not loaded. Call loadModernInteriorsAtlasIndex().",
    );
  }
  return _designs;
}

export function getModernInteriorsDesignLayers(design: string): ModernInteriorsAtlasEntry[] {
  return getModernInteriorsEntries()
    .filter((entry) => entry.sourceKind === "home_design_layer" && entry.design === design)
    .sort(compareModernInteriorsLayers);
}

export interface AtlasSprite {
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
  theme: string;
}

/** Compact on-disk format: sprites grouped by theme as [x,y,w,h] arrays. */
interface CompactAtlasIndex {
  atlas: string;
  tileSize: number;
  atlasWidth: number;
  atlasHeight: number;
  matched: number;
  unmatched: number;
  themes: Record<string, Record<string, [number, number, number, number]>>;
}

export const ATLAS_PREFIX = "atlas:";

export interface AtlasSpriteEntry {
  key: string;
  sprite: AtlasSprite;
  propType: string;
}

/** Flat sprite lookup by original key (e.g. "21_Beach_16x16_Ball"). */
let _sprites: Record<string, AtlasSprite> | null = null;
let _entries: AtlasSpriteEntry[] | null = null;
let _themes: string[] | null = null;

/** Reconstruct the original atlas key from theme + name. */
function buildKey(theme: string, name: string): string {
  return theme ? `${theme}_16x16_${name}` : name;
}

/** Fetch and inflate the compact atlas index. Must be called before using other functions. */
export async function loadAtlasIndex(): Promise<void> {
  if (_sprites) return; // already loaded
  const res = await fetch("data/me-atlas-index.json");
  if (!res.ok) throw new Error(`Failed to load atlas index: ${res.status}`);
  const compact: CompactAtlasIndex = await res.json();

  const sprites: Record<string, AtlasSprite> = {};
  const entries: AtlasSpriteEntry[] = [];
  const themeList: string[] = [];

  for (const [theme, names] of Object.entries(compact.themes)) {
    if (theme) themeList.push(theme);
    for (const [name, rect] of Object.entries(names)) {
      const key = buildKey(theme, name);
      const sprite: AtlasSprite = {
        x: rect[0],
        y: rect[1],
        w: rect[2],
        h: rect[3],
        name,
        theme,
      };
      sprites[key] = sprite;
      entries.push({ key, sprite, propType: `${ATLAS_PREFIX}${key}` });
    }
  }

  _sprites = sprites;
  _entries = entries;
  _themes = themeList.sort();
}

/** Get the flat sprite lookup. Throws if atlas not yet loaded. */
export function getAtlasSprites(): Record<string, AtlasSprite> {
  if (!_sprites) throw new Error("Atlas index not loaded — call loadAtlasIndex() first");
  return _sprites;
}

/** Get all atlas sprite entries as a flat array. */
export function getAtlasEntries(): AtlasSpriteEntry[] {
  if (!_entries) throw new Error("Atlas index not loaded — call loadAtlasIndex() first");
  return _entries;
}

/** Get the sorted unique theme list. */
export function getAtlasThemes(): string[] {
  if (!_themes) throw new Error("Atlas index not loaded — call loadAtlasIndex() first");
  return _themes;
}

/** Check if the atlas index has been loaded. */
export function isAtlasLoaded(): boolean {
  return _sprites !== null;
}

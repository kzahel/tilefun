import rawAtlas from "../../data/me-atlas-index.json";

export interface AtlasSprite {
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
  theme: string;
}

export interface AtlasIndexData {
  atlas: string;
  tile_size: number;
  atlas_width: number;
  atlas_height: number;
  total_singles: number;
  matched: number;
  unmatched: number;
  sprites: Record<string, AtlasSprite>;
}

export const ATLAS_INDEX = rawAtlas as unknown as AtlasIndexData;

export const ATLAS_PREFIX = "atlas:";

export interface AtlasSpriteEntry {
  key: string;
  sprite: AtlasSprite;
  propType: string;
}

let _entries: AtlasSpriteEntry[] | null = null;
let _themes: string[] | null = null;

/** Lazily build the flat array of all atlas sprite entries. */
export function getAtlasEntries(): AtlasSpriteEntry[] {
  if (!_entries) {
    _entries = Object.entries(ATLAS_INDEX.sprites).map(([key, sprite]) => ({
      key,
      sprite,
      propType: `${ATLAS_PREFIX}${key}`,
    }));
  }
  return _entries;
}

/** Lazily extract the sorted unique theme list. */
export function getAtlasThemes(): string[] {
  if (!_themes) {
    const themeSet = new Set<string>();
    for (const sprite of Object.values(ATLAS_INDEX.sprites)) {
      if (sprite.theme) themeSet.add(sprite.theme);
    }
    _themes = [...themeSet].sort();
  }
  return _themes;
}

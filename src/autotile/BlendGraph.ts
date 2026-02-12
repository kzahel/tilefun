import { ALL_TERRAIN_IDS, TERRAIN_DEPTH, TerrainId } from "./TerrainId.js";

/** Maximum blend layers per tile (background fills + dedicated pairs + alpha). */
export const MAX_BLEND_LAYERS = 6;

/** Describes how to render the blend between two terrain types. */
export interface BlendEntry {
  /** Index into the blendSheets array. */
  sheetIndex: number;
  /** Spritesheet key for Map<string, Spritesheet> lookup. */
  sheetKey: string;
  /** Asset path for loading. */
  assetPath: string;
  /** True for alpha overlay sheets (drawn last, semi-transparent). */
  isAlpha: boolean;
  /** Draw priority: lower = drawn earlier. Based on neighbor terrain depth. */
  priority: number;
}

/** Sheet descriptor for loading. */
export interface SheetDescriptor {
  sheetKey: string;
  assetPath: string;
}

/** Base fill: the solid fill sprite (mask 255) for a terrain. */
export interface BaseFill {
  sheetIndex: number;
  col: number;
  row: number;
}

/**
 * Blend sheet graph: maps (myTerrain, neighborTerrain) → BlendEntry.
 *
 * For each terrain pair, determines whether to use a dedicated pair sheet,
 * a dedicated pair sheet or an alpha overlay fallback.
 */
export class BlendGraph {
  /** (myTerrain * TERRAIN_COUNT + neighborTerrain) → BlendEntry */
  private readonly entries = new Map<number, BlendEntry>();

  /** Indexed sheets array — sheetIndex maps to this array position. */
  readonly allSheets: SheetDescriptor[] = [];

  /** Base fill per terrain (mask 255 solid fill sprite). */
  private readonly baseFills = new Map<TerrainId, BaseFill>();

  /** Alpha overlay per terrain. */
  private readonly alphas = new Map<TerrainId, BlendEntry>();

  /** sheetKey → sheetIndex */
  private readonly sheetIndexMap = new Map<string, number>();

  constructor() {
    this.registerSheets();
    this.buildDedicatedPairs();
    this.buildAlphaFallbacks();
    this.buildBaseFills();
  }

  /** Look up the blend entry for (myTerrain, neighborTerrain). */
  getBlend(my: TerrainId, neighbor: TerrainId): BlendEntry | undefined {
    if (my === neighbor) return undefined;
    return this.entries.get(my * 8 + neighbor);
  }

  /** Get the base fill (mask 255 solid sprite) for a terrain. */
  getBaseFill(terrain: TerrainId): BaseFill | undefined {
    return this.baseFills.get(terrain);
  }

  /** Get the alpha overlay entry for a terrain. */
  getAlpha(terrain: TerrainId): BlendEntry | undefined {
    return this.alphas.get(terrain);
  }

  private addSheet(key: string, path: string): number {
    const existing = this.sheetIndexMap.get(key);
    if (existing !== undefined) return existing;
    const index = this.allSheets.length;
    this.allSheets.push({ sheetKey: key, assetPath: path });
    this.sheetIndexMap.set(key, index);
    return index;
  }

  private registerSheets(): void {
    // Register all natural ME autotile sheets we'll use
    this.addSheet("me01", "assets/tilesets/me-autotile-01.png"); // dirt_light/grass
    this.addSheet("me02", "assets/tilesets/me-autotile-02.png"); // dirt_warm/grass
    this.addSheet("me03", "assets/tilesets/me-autotile-03.png"); // water_shallow/grass
    this.addSheet("me07", "assets/tilesets/me-autotile-07.png"); // sand_light/grass
    this.addSheet("me08", "assets/tilesets/me-autotile-08.png"); // sand/water_shallow
    this.addSheet("me09", "assets/tilesets/me-autotile-09.png"); // sand/sand_light
    this.addSheet("me10", "assets/tilesets/me-autotile-10.png"); // sand alpha
    this.addSheet("me12", "assets/tilesets/me-autotile-12.png"); // grass/dirt_warm
    this.addSheet("me13", "assets/tilesets/me-autotile-13.png"); // grass alpha
    this.addSheet("me15", "assets/tilesets/me-autotile-15.png"); // grass/water_shallow
    this.addSheet("me16", "assets/tilesets/me-autotile-16.png"); // water_deep/water_shallow
    this.addSheet("debug3c", "assets/tilesets/debug-3color.png"); // debug green/dirt_warm
  }

  private set(my: TerrainId, neighbor: TerrainId, entry: BlendEntry): void {
    this.entries.set(my * 8 + neighbor, entry);
  }

  private sheetIdx(key: string): number {
    const idx = this.sheetIndexMap.get(key);
    if (idx === undefined) throw new Error(`Unknown sheet key: ${key}`);
    return idx;
  }

  private dedicatedEntry(sheetKey: string, neighborTerrain: TerrainId): BlendEntry {
    const idx = this.sheetIdx(sheetKey);
    const desc = this.allSheets[idx];
    if (!desc) throw new Error(`No sheet at index ${idx}`);
    return {
      sheetIndex: idx,
      sheetKey: desc.sheetKey,
      assetPath: desc.assetPath,
      isAlpha: false,
      priority: TERRAIN_DEPTH[neighborTerrain],
    };
  }

  private buildDedicatedPairs(): void {
    // #16: water_deep (primary) over water_shallow (secondary)
    this.set(
      TerrainId.DeepWater,
      TerrainId.ShallowWater,
      this.dedicatedEntry("me16", TerrainId.ShallowWater),
    );

    // #8: sand (primary) over water_shallow (secondary)
    this.set(
      TerrainId.Sand,
      TerrainId.ShallowWater,
      this.dedicatedEntry("me08", TerrainId.ShallowWater),
    );

    // #9: sand (primary) over sand_light (secondary)
    this.set(TerrainId.Sand, TerrainId.SandLight, this.dedicatedEntry("me09", TerrainId.SandLight));

    // #7: sand_light (primary) over grass (secondary)
    this.set(TerrainId.SandLight, TerrainId.Grass, this.dedicatedEntry("me07", TerrainId.Grass));

    // #1: dirt_light (primary) over grass (secondary)
    this.set(TerrainId.DirtLight, TerrainId.Grass, this.dedicatedEntry("me01", TerrainId.Grass));

    // #2: dirt_warm (primary) over grass (secondary)
    this.set(TerrainId.DirtWarm, TerrainId.Grass, this.dedicatedEntry("me02", TerrainId.Grass));
    // #12: grass (primary) over dirt_warm (secondary) — dedicated reverse pair
    this.set(TerrainId.Grass, TerrainId.DirtWarm, this.dedicatedEntry("me12", TerrainId.DirtWarm));

    // #3: water_shallow (primary) over grass (secondary)
    this.set(TerrainId.ShallowWater, TerrainId.Grass, this.dedicatedEntry("me03", TerrainId.Grass));
    // #15: grass (primary) over water_shallow (secondary) — dedicated reverse pair
    this.set(
      TerrainId.Grass,
      TerrainId.ShallowWater,
      this.dedicatedEntry("me15", TerrainId.ShallowWater),
    );

    // debug 3-color: DebugGreen (primary) over DirtWarm (secondary)
    this.set(
      TerrainId.DebugGreen,
      TerrainId.DirtWarm,
      this.dedicatedEntry("debug3c", TerrainId.DirtWarm),
    );
  }

  private alphaEntry(sheetKey: string, neighborTerrain: TerrainId): BlendEntry {
    const idx = this.sheetIdx(sheetKey);
    const desc = this.allSheets[idx];
    if (!desc) throw new Error(`No sheet at index ${idx}`);
    return {
      sheetIndex: idx,
      sheetKey: desc.sheetKey,
      assetPath: desc.assetPath,
      isAlpha: true,
      priority: TERRAIN_DEPTH[neighborTerrain],
    };
  }

  private buildAlphaFallbacks(): void {
    // Register alpha overlay sheets per terrain
    this.alphas.set(TerrainId.Grass, this.alphaEntry("me13", TerrainId.Grass));
    // No alpha for DirtLight/DirtWarm: their only valid blend is with grass,
    // which already has dedicated sheets (ME#01, ME#02). Grass alpha would
    // produce green edges on non-grass neighbors (sand, water, etc.).
    this.alphas.set(TerrainId.Sand, this.alphaEntry("me10", TerrainId.Sand));
    this.alphas.set(TerrainId.SandLight, this.alphaEntry("me10", TerrainId.SandLight));
    // No alpha for water terrains: grass alpha (me13) would produce green
    // edges on water, which is visually wrong. Water transitions should use
    // dedicated pair sheets only (me03/me15/me16).

    // Fill all remaining (T, N) pairs that don't have dedicated sheets with alpha fallback
    for (const my of ALL_TERRAIN_IDS) {
      for (const neighbor of ALL_TERRAIN_IDS) {
        if (my === neighbor) continue;
        if (this.entries.has(my * 8 + neighbor)) continue;

        // Use the tile's own alpha overlay
        const alpha = this.alphas.get(my);
        if (alpha) {
          this.set(my, neighbor, { ...alpha, priority: TERRAIN_DEPTH[neighbor] });
        }
      }
    }
  }

  private buildBaseFills(): void {
    // Each terrain's solid fill comes from a sheet where it is primary, at position (1,0) = mask 255
    const fills: [TerrainId, string][] = [
      [TerrainId.DeepWater, "me16"],
      [TerrainId.ShallowWater, "me03"],
      [TerrainId.Sand, "me08"],
      [TerrainId.SandLight, "me07"],
      [TerrainId.Grass, "me15"],
      [TerrainId.DirtLight, "me01"],
      [TerrainId.DirtWarm, "me02"],
      [TerrainId.DebugGreen, "debug3c"],
    ];
    for (const [terrain, sheetKey] of fills) {
      this.baseFills.set(terrain, {
        sheetIndex: this.sheetIdx(sheetKey),
        col: 1,
        row: 0,
      });
    }
  }
}

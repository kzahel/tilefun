import type { Spritesheet } from "./Spritesheet.js";

export interface TileCoord {
  col: number;
  row: number;
}

/**
 * Manages groups of tile variants from a large tileset spritesheet.
 * Picks variants deterministically based on world position for a
 * non-repeating but stable pattern.
 */
export class TileVariants {
  private groups = new Map<string, TileCoord[]>();
  /** When false, drawVariant always returns false (falls back to default fill). */
  enabled = false;

  constructor(readonly sheet: Spritesheet) {}

  /** Register a rectangular region of variant tiles. */
  addRect(group: string, startCol: number, startRow: number, cols: number, rows: number): void {
    const tiles = this.groups.get(group) ?? [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        tiles.push({ col: startCol + c, row: startRow + r });
      }
    }
    this.groups.set(group, tiles);
  }

  /** Register individual tile positions. */
  addTiles(group: string, tiles: readonly TileCoord[]): void {
    const existing = this.groups.get(group) ?? [];
    existing.push(...tiles);
    this.groups.set(group, existing);
  }

  /** Check if a group has any variants registered. */
  has(group: string): boolean {
    const tiles = this.groups.get(group);
    return tiles !== undefined && tiles.length > 0;
  }

  /** Get the number of variants in a group. */
  count(group: string): number {
    return this.groups.get(group)?.length ?? 0;
  }

  /** Pick a deterministic variant tile based on world tile position. */
  pick(group: string, tileX: number, tileY: number): TileCoord | undefined {
    const tiles = this.groups.get(group);
    if (!tiles || tiles.length === 0) return undefined;
    // Spatial hash for stable, non-repeating selection
    const hash = ((tileX * 73856093) ^ (tileY * 19349663)) >>> 0;
    return tiles[hash % tiles.length];
  }

  /** Draw a variant tile at the given destination. Returns true if drawn. */
  drawVariant(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    group: string,
    tileX: number,
    tileY: number,
    destX: number,
    destY: number,
    scale = 1,
  ): boolean {
    if (!this.enabled) return false;
    const coord = this.pick(group, tileX, tileY);
    if (!coord) return false;
    this.sheet.drawTile(ctx, coord.col, coord.row, destX, destY, scale);
    return true;
  }
}

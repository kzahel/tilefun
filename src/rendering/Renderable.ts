/** Minimal interface for anything that can be drawn Y-sorted by EntityRenderer. */
export interface Renderable {
  position: { wx: number; wy: number };
  /** Adjusts the Y used for depth sorting (negative = sort as if higher/behind). */
  sortOffsetY?: number;
  sprite: {
    sheetKey: string;
    frameCol: number;
    frameRow: number;
    spriteWidth: number;
    spriteHeight: number;
  } | null;
}

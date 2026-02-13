/** Minimal interface for anything that can be drawn Y-sorted by EntityRenderer. */
export interface Renderable {
  position: { wx: number; wy: number };
  sprite: {
    sheetKey: string;
    frameCol: number;
    frameRow: number;
    spriteWidth: number;
    spriteHeight: number;
  } | null;
}

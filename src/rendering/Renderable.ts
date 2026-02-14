/** Minimal interface for anything that can be drawn Y-sorted by EntityRenderer. */
export interface Renderable {
  position: { wx: number; wy: number };
  /** Previous position (before last tick), for render interpolation. */
  prevPosition?: { wx: number; wy: number };
  /** Adjusts the Y used for depth sorting (negative = sort as if higher/behind). */
  sortOffsetY?: number;
  sprite: {
    sheetKey: string;
    frameCol: number;
    frameRow: number;
    spriteWidth: number;
    spriteHeight: number;
    flipX?: boolean;
    drawOffsetY?: number;
  } | null;
  /** When true, skip entity-specific effects like shadows. */
  isProp?: boolean;
  /** When true, skip drawing a shadow under this entity. */
  noShadow?: boolean;
  /** When true, entity is hidden this frame (invincibility flash effect). */
  flashHidden?: boolean;
  /** Current height above ground in world pixels (jump mechanic). */
  jumpZ?: number;
}

import type { FacadePiece } from "../generation/regional/BuildingRecipes.js";
export interface PropCollider {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  /** Z-axis base (default 0 = ground level). */
  zBase?: number;
  /** Z-axis extent above zBase (default infinity = full-height wall). */
  zHeight?: number;
  /** Whether the top surface is a walkable platform. Requires finite zHeight. */
  walkableTop?: boolean;
  /** When true, this collider only affects walkable surface height — it does not block movement. */
  passable?: boolean;
}

/**
 * A static placed decoration. Much leaner than Entity — no velocity, AI, or animation.
 * Sprite field names match Entity so props can be Y-sort-merged with entities for drawing.
 */
export interface Prop {
  persistentId?: string;
  id: number;
  proceduralId?: string;
  type: string;
  position: { wx: number; wy: number };
  /** Explicit asset depth datum; omitted for all legacy props. */
  sortOffsetY?: number;
  sprite: {
    parts?: readonly FacadePiece[];
    sheetKey: string;
    frameCol: number;
    frameRow: number;
    spriteWidth: number;
    spriteHeight: number;
  };
  collider: PropCollider | null;
  /** Wall segments for enterable props. When present, movement collision checks
   *  these instead of the single `collider`. Each wall is a PropCollider rect. */
  walls: PropCollider[] | null;
  isProp: true;
}

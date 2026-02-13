export interface PropCollider {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

/**
 * A static placed decoration. Much leaner than Entity — no velocity, AI, or animation.
 * Sprite field names match Renderable so props can be Y-sort-merged with entities for drawing.
 */
export interface Prop {
  id: number;
  type: string;
  position: { wx: number; wy: number };
  sprite: {
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

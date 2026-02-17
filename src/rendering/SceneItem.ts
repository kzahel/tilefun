/**
 * Discriminated union of all visual items that participate in Y-sorted
 * scene rendering. All positions are world-space (world pixels).
 * The renderer backend (Canvas2D, WebGL, etc.) projects to screen.
 */

export type SceneItem = SpriteItem | ElevationItem | GrassItem | ParticleItem;

export interface SpriteItem {
  kind: "sprite";
  sortKey: number;
  /** Interpolated world position (feet = bottom-center). */
  wx: number;
  wy: number;
  /** Total visual Z in world pixels (lerped from wz, or terrain+jumpZ for props). */
  zOffset: number;
  /** Sprite sheet key. */
  sheetKey: string;
  frameCol: number;
  frameRow: number;
  spriteWidth: number;
  spriteHeight: number;
  flipX: boolean;
  /** Visual draw offset in world pixels (negative = draw higher). */
  drawOffsetY: number;
  /** Whether to draw a ground shadow. */
  hasShadow: boolean;
  /** World Y of entity feet (for shadow placement). */
  shadowFeetWy: number;
  /** Shadow width in world pixels. */
  shadowWidth: number;
  /** Terrain elevation at feet in world pixels (shadow renders at ground level). */
  shadowTerrainZ: number;
  /** When true, entity is hidden this frame (invincibility flash). */
  flashHidden: boolean;
  /** Optional per-item alpha (debug overlays, ghost sprites). */
  alpha?: number;
}

export interface ElevationItem {
  kind: "elevation";
  sortKey: number;
  /**
   * "surface" draws the tile shifted up (background for entities on this level).
   * "cliff" draws the cliff face (occludes entities at lower elevations).
   */
  phase: "surface" | "cliff";
  /** Tile top-left world X. */
  wx: number;
  /** Tile top-left world Y. */
  wy: number;
  /** Reference to the chunk's OffscreenCanvas cache. */
  chunkCache: OffscreenCanvas;
  /** Source X in chunk cache (native pixels). */
  srcX: number;
  /** Source Y in chunk cache (native pixels). */
  srcY: number;
  /** Height level (integer, typically 1-3). */
  height: number;
}

export interface GrassItem {
  kind: "grass";
  sortKey: number;
  wx: number;
  wy: number;
  /** Variant index (0-3) into grass spritesheet. */
  variant: number;
  /** Pre-computed sway + push angle in radians. */
  angle: number;
}

export interface ParticleItem {
  kind: "particle";
  sortKey: number;
  wx: number;
  wy: number;
  /** Visual Z offset in world pixels. */
  z: number;
  /** Radius in world pixels. */
  size: number;
  color: string;
  /** Opacity 0-1. */
  alpha: number;
}

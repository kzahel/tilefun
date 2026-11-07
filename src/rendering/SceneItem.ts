import type { Direction } from "../entities/Entity.js";
import type { MeshInstance } from "./MeshPresentation.js";
import type { DecalMask } from "./ProjectedDecals.js";
import type { Plane, SurfaceVertex } from "./SurfaceReceivers.js";
import type { TerrainResourceId } from "./TerrainPresentation.js";

/**
 * Discriminated union of all visual items that participate in Y-sorted
 * scene rendering. All positions are world-space (world pixels).
 * The renderer backend (Canvas2D, WebGL, etc.) projects to screen.
 */

export type SceneItem = SpriteItem | ElevationItem | GrassItem | ParticleItem | DecalItem;

export interface SpriteItem {
  /** A coupled car shares the tow truck depth target; fallbacks draw the same pair. */
  towGroup?: SpriteItem;
  /** One opt-in truck body and upright sprite planes share its local depth target.
   * Raster fallbacks use the same plain bed profile to clip the contents. */
  bedGroup?: {
    heading: number;
    tilt?: number;
    vehicle?: "transporter";
    ramp?: boolean;
    contents: SpriteItem[];
  };
  /** Optional representation; all sprite fields remain the complete fallback. */
  mesh?: MeshInstance;
  /** Ready mesh actually drawn this frame; prevents a second shadow on sprite fallbacks. */
  shadowCasterId?: number;
  /** Sprite rider's visual attachment, applied only while its supporting mesh is ready. */
  meshRoofSupport?: {
    assetId: string;
    heightDelta: number;
    ownerAssetId?: string;
    offsetX?: number;
    offsetY?: number;
  };
  /** Detailed-bed foot follows its owner’s mesh tilt; sprite fallback stays physical. */
  meshBedSupport?: boolean;
  emergencyFlash?: number;
  emergencyColors?: readonly [string, string];
  emergencySide?: number;
  emergencyHeight?: number;
  emergencyForward?: number;
  emergencyHeading?: number;
  kind: "sprite";
  /** Actor-owned image, including at rest; static adjoining prop pieces keep shared edges. */
  subpixel?: boolean;
  sortKey: number;
  /** Interpolated world position (feet = bottom-center). */
  wx: number;
  wy: number;
  /** Upright plane for world depth when the pixels do not stand at `wy`, such as a
   * prop crop depicting a raised deck. Draw placement and ordering still use `wy`. */
  depthWy?: number;
  /** Pixels depict a horizontal floor at this height: world depth uses that plane. */
  depthFloorZ?: number;
  /** Total visual Z in world pixels (lerped from wz, or terrain+jumpZ for props). */
  zOffset: number;
  /** Sprite sheet key. */
  sheetKey: string;
  frameCol: number;
  frameRow: number;
  /** Facing of a four-direction sheet (players, turning wanderers) whose current row
   * is that facing. Views that see the actor from other sides (first person, 229)
   * reselect the row; the fixed view ignores it. Absent for every other sprite. */
  facing?: Direction;
  spriteWidth: number;
  spriteHeight: number;
  /** Destination-only vertical compression; source sheet pixels stay unchanged. */
  scaleY?: number;
  flipX: boolean;
  /** Visual draw offset in world pixels (negative = draw higher). */
  drawOffsetY: number;
  /** Whether to draw a ground shadow. */
  hasShadow: boolean;
  /** Physical mesh uses a separate ground shadow; baked sprite fallbacks already contain theirs. */
  meshGroundShadow?: boolean;
  /** World Y of entity feet (for shadow placement). */
  shadowFeetWy: number;
  /** Shadow width in world pixels. */
  shadowWidth: number;
  /** Terrain elevation at feet in world pixels (shadow renders at ground level). */
  shadowTerrainZ: number;
  /** When true, entity is hidden this frame (invincibility flash). */
  flashHidden: boolean;
  /** Optional per-item alpha (debug overlays). */
  alpha?: number;
}

export interface ElevationItem {
  readonly kind: "elevation";
  readonly sortKey: number;
  /**
   * "surface" draws the tile shifted up (background for entities on this level).
   * "cliff" draws the cliff face (occludes entities at lower elevations).
   */
  readonly phase: "surface" | "cliff";
  /** Tile top-left world X. */
  readonly wx: number;
  /** Tile top-left world Y. */
  readonly wy: number;
  /** Backend-owned imagery; resolved only while consuming this frame. */
  readonly terrainResource: TerrainResourceId;
  /** Source X in chunk cache (native pixels). */
  readonly srcX: number;
  /** Source Y in chunk cache (native pixels). */
  readonly srcY: number;
  /** Height level (integer, typically 1-3). */
  readonly height: number;
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
  /** Presentation opacity for grass LOD; omitted/undefined means full detail. */
  alpha?: number | undefined;
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

/** Finite receiver-local pieces, carrying world positions and stable mask UVs. */
export interface DecalItem {
  kind: "decal";
  sortKey: number;
  wx: number;
  wy: number;
  z: number;
  receiverId: string;
  plane: Plane;
  polygons: SurfaceVertex[][];
  mask: DecalMask;
  alpha: number;
  color: string;
  meshAssetId?: string;
  meshCasterId?: number;
}

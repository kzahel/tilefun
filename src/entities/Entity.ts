/** Movement/facing direction. Row index in character spritesheet. */
export enum Direction {
  Down = 0,
  Up = 1,
  Left = 2,
  Right = 3,
}

export interface PositionComponent {
  wx: number;
  wy: number;
}

export interface VelocityComponent {
  vx: number;
  vy: number;
}

export interface SpriteComponent {
  sheetKey: string;
  /** Current animation frame column. */
  frameCol: number;
  /** Current direction row in spritesheet. */
  frameRow: number;
  /** Milliseconds elapsed in current frame. */
  animTimer: number;
  /** Milliseconds per frame. */
  frameDuration: number;
  /** Number of frames per animation cycle. */
  frameCount: number;
  direction: Direction;
  moving: boolean;
  /** When true, sprite is drawn mirrored horizontally. */
  flipX?: boolean;
  /** Pixel width of one frame in the spritesheet. */
  spriteWidth: number;
  /** Pixel height of one frame in the spritesheet. */
  spriteHeight: number;
  /** Visual offset in world pixels applied when drawing (negative = draw higher). Does not affect position or collision. */
  drawOffsetY?: number;
}

export interface ColliderComponent {
  /** Offset from entity position (center-bottom). */
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  /** When false, collider is visual-only (debug box) and doesn't block movement. Default true. */
  solid?: boolean;
  /** When true, client predicts collision with this entity (no rubber-banding). */
  clientSolid?: boolean;
  /** Z-axis extent above feet in world pixels. Used for 3D entity-entity collision filtering. */
  physicalHeight?: number;
}

export interface WanderAIComponent {
  state: "idle" | "walking" | "chasing" | "following" | "ridden" | "scared";
  /** Time remaining in current state (seconds). */
  timer: number;
  /** Movement direction when walking. */
  dirX: number;
  dirY: number;
  idleMin: number;
  idleMax: number;
  walkMin: number;
  walkMax: number;
  /** Movement speed in px/s. */
  speed: number;
  /** When true, sprite.frameRow is updated from movement direction. */
  directional: boolean;
  /** Pixel range within which this entity chases the player. */
  chaseRange?: number;
  /** Speed when chasing (px/s). */
  chaseSpeed?: number;
  /** When true, contact with player causes gem loss + knockback. */
  hostile?: boolean;
  /** When true, entity is currently following the player as a buddy. */
  following?: boolean;
  /** Minimum distance to keep when following (px). */
  followDistance?: number;
  /** Max distance before the entity gives up following and returns to wandering (px). */
  followLeash?: number;
  /** When true, player can tap this entity to make it follow. */
  befriendable?: boolean;
  /** Speed in px/s when ridden by a player. */
  rideSpeed?: number;
  /** Remaining seconds of scared behavior after being hit by a ball (server-only). */
  scaredTimer?: number;
}

export interface Entity {
  id: number;
  type: string;
  position: PositionComponent;
  /** Previous position (before last physics tick), for render interpolation. Ephemeral. */
  prevPosition?: PositionComponent;
  /** Adjusts the Y used for depth sorting (negative = sort as if higher/behind). */
  sortOffsetY?: number;
  velocity: VelocityComponent | null;
  sprite: SpriteComponent | null;
  collider: ColliderComponent | null;
  wanderAI: WanderAIComponent | null;
  /** When true, entity is hidden this frame (invincibility flash effect). */
  flashHidden?: boolean;
  /** When true, skip drawing a shadow under this entity. */
  noShadow?: boolean;
  /** Countdown timer (seconds) — entity flashes then is removed when it reaches 0. */
  deathTimer?: number;
  /** Tags for scripting API (ephemeral, not persisted). */
  tags?: Set<string>;
  /** Per-entity key-value attributes for scripting API (ephemeral, not persisted). */
  attributes?: Map<string, unknown>;
  /** Accumulated time since last AI/physics tick (server-only, not serialized). */
  tickAccumulator?: number;
  /** Current height above ground in world pixels (jump mechanic). Derived from wz - groundZ. */
  jumpZ?: number;
  /** Previous jumpZ (before last tick), for render interpolation. Ephemeral. */
  prevJumpZ?: number;
  /** Previous wz (before last tick), for render interpolation. Ephemeral. */
  prevWz?: number;
  /** Vertical velocity in world px/s, positive = up. */
  jumpVZ?: number;
  /** Absolute Z position in world pixels (0 = world floor). */
  wz?: number;
  /** Computed surface height at entity feet in world pixels (not serialized, computed each tick). */
  groundZ?: number;
  /** ID of the parent entity this entity is attached to (riding, carried, on platform, etc.). */
  parentId?: number;
  /** Local X offset from parent's position (world pixels). Only meaningful when parentId is set. */
  localOffsetX?: number;
  /** Local Y offset from parent's position (world pixels). Only meaningful when parentId is set. */
  localOffsetY?: number;
  /** Mass in kg. Affects footstep audio volume/pitch (heavier = louder, lower pitch). */
  weight?: number;
}

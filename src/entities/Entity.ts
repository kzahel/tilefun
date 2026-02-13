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
  /** Pixel width of one frame in the spritesheet. */
  spriteWidth: number;
  /** Pixel height of one frame in the spritesheet. */
  spriteHeight: number;
}

export interface ColliderComponent {
  /** Offset from entity position (center-bottom). */
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

export interface WanderAIComponent {
  state: "idle" | "walking";
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
}

export interface Entity {
  id: number;
  type: string;
  position: PositionComponent;
  /** Adjusts the Y used for depth sorting (negative = sort as if higher/behind). */
  sortOffsetY?: number;
  velocity: VelocityComponent | null;
  sprite: SpriteComponent | null;
  collider: ColliderComponent | null;
  wanderAI: WanderAIComponent | null;
}

/** Pixels per tile in the source spritesheet. */
export const TILE_SIZE = 16;

/** Tiles per chunk side (chunk = CHUNK_SIZE x CHUNK_SIZE tiles). */
export const CHUNK_SIZE = 16;

/** Pixels per chunk side. */
export const CHUNK_SIZE_PX = TILE_SIZE * CHUNK_SIZE;

/** Canvas pixel scaling (16px tiles rendered at 48px). */
export const PIXEL_SCALE = 3;

/** Chunks beyond the viewport to keep loaded. */
export const RENDER_DISTANCE = 1;

/** Chunks beyond the viewport to unload from memory. */
export const UNLOAD_DISTANCE = 3;

/** Fixed update tick rate in Hz. */
export const TICK_RATE = 60;

/** Player movement speed in world pixels per second. */
export const PLAYER_SPEED = 64;

/** Speed multiplier when holding shift. */
export const PLAYER_SPRINT_MULTIPLIER = 2;

// ── Friction & acceleration (QuakeWorld-inspired) ──

/** Base ground friction (QW default: 4, higher = snappier stops). */
export const PLAYER_FRICTION = 6;

/** Ground acceleration multiplier (QW default: 10). */
export const PLAYER_ACCELERATE = 10;

/** Friction uses this as minimum speed for the control term (QW: 100). */
export const PLAYER_STOP_SPEED = 16;

/** Below this speed, velocity is zeroed (prevents micro-drift). */
export const PLAYER_STOP_THRESHOLD = 2;

/** Camera smooth-follow lerp factor (per tick at 60Hz). */
export const CAMERA_LERP = 0.1;

/** Size of each frame in the character spritesheet (pixels). */
export const PLAYER_SPRITE_SIZE = 16;

/** Duration of each walk animation frame (milliseconds). */
export const PLAYER_FRAME_DURATION = 150;

/** Size of each frame in the chicken spritesheet (pixels). */
export const CHICKEN_SPRITE_SIZE = 16;

/** Number of animation frames in the water spritesheet. */
export const WATER_FRAME_COUNT = 4;

/** Duration of each water animation frame (milliseconds). */
export const WATER_FRAME_DURATION_MS = 250;

/** Entities beyond this Chebyshev distance from the player are frozen (world pixels). */
export const ENTITY_ACTIVATION_DISTANCE = CHUNK_SIZE_PX * (UNLOAD_DISTANCE - 1);

/** World-pixel Y-offset per elevation level. */
export const ELEVATION_PX = 8;

/** Maximum tile elevation level (0–3). */
export const MAX_ELEVATION = 3;

/** Jump initial upward velocity in world px/s. */
export const JUMP_VELOCITY = 150;

/** Jump gravity in world px/s². */
export const JUMP_GRAVITY = 500;

/** Velocity multiplier applied when jump button is released while ascending (variable jump height). */
export const JUMP_CUT_MULTIPLIER = 0.4;

/** Default physical height (world px) for entities missing collider.physicalHeight. */
export const DEFAULT_PHYSICAL_HEIGHT = 8;

/** Max elevation step (world px) an entity can walk up without jumping. Half an ELEVATION_PX level. */
export const STEP_UP_THRESHOLD = 4;

// ── Ball throwing ──

/** Minimum throw speed in world px/s (quick tap). */
export const THROW_MIN_SPEED = 180;

/** Maximum throw speed in world px/s (full charge). */
export const THROW_MAX_SPEED = 300;

/** Launch angle in radians (30 degrees from horizontal). */
export const THROW_ANGLE = Math.PI / 6;

/** Gravity for balls in world px/s² (floatier than jump gravity). */
export const BALL_GRAVITY = 400;

/** Fraction of velocity retained per bounce (vertical and horizontal). */
export const BOUNCE_RESTITUTION = 0.55;

/** Fraction of horizontal speed retained on ground bounce. */
export const BOUNCE_FRICTION = 0.75;

/** Minimum vertical speed to keep bouncing (below this the ball stops). */
export const BOUNCE_STOP_VZ = 15;

/** Speed impulse applied to entities hit by a ball (world px/s). */
export const BALL_PUSH_SPEED = 60;

/** Seconds before a stopped ball despawns. */
export const BALL_DESPAWN_TIME = 3.0;

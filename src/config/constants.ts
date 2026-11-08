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

/** Max number of loaded chunks to run autotile blending on per update tick. */
export const MAX_AUTOTILE_CHUNKS_PER_UPDATE = 2;

/** Max number of chunk cache rows to rebuild per rendered frame. */
export const MAX_CHUNK_CACHE_ROWS_PER_FRAME = 4;

/** Fixed update tick rate in Hz. */
export const TICK_RATE = 60;

/** Player movement speed in world pixels per second. */
export const PLAYER_SPEED = 64;

/** Speed multiplier when holding shift. */
export const PLAYER_SPRINT_MULTIPLIER = 2;

// ── Friction & acceleration (QuakeWorld-inspired) ──

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

/** World-pixel Y-offset per elevation level. */
export const ELEVATION_PX = 8;

/** Maximum tile elevation level (0–3). */
export const MAX_ELEVATION = 3;

/** Jump initial upward velocity in world px/s. */
export const JUMP_VELOCITY = 150;

/** Jump gravity in world px/s². */
export const JUMP_GRAVITY = 500;

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

/** Seconds before a stopped ball despawns. */
export const BALL_DESPAWN_TIME = 3.0;

/** Seconds an NPC stays scared after being hit by a ball. */
export const BALL_SCARE_DURATION = 3.0;

/** Speed multiplier for scared NPC movement. */
export const BALL_SCARE_SPEED_MULT = 3;

/** Backdrop behind the world and around rooms, shared by the fixed and first-person views. */
export const VIEW_BACKDROP_CSS = "#1a1a2e";

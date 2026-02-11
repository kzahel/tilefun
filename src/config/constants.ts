/** Pixels per tile in the source spritesheet. */
export const TILE_SIZE = 16;

/** Tiles per chunk side (chunk = CHUNK_SIZE x CHUNK_SIZE tiles). */
export const CHUNK_SIZE = 16;

/** Pixels per chunk side. */
export const CHUNK_SIZE_PX = TILE_SIZE * CHUNK_SIZE;

/** Canvas pixel scaling (16px tiles rendered at 48px). */
export const PIXEL_SCALE = 3;

/** Chunks beyond the viewport to keep loaded. */
export const RENDER_DISTANCE = 3;

/** Chunks beyond the viewport to unload from memory. */
export const UNLOAD_DISTANCE = 5;

/** Fixed update tick rate in Hz. */
export const TICK_RATE = 60;

/** Player movement speed in world pixels per second. */
export const PLAYER_SPEED = 64;

/** Camera smooth-follow lerp factor (per tick at 60Hz). */
export const CAMERA_LERP = 0.1;

/** Size of each frame in the character spritesheet (pixels). */
export const PLAYER_SPRITE_SIZE = 48;

/** Duration of each walk animation frame (milliseconds). */
export const PLAYER_FRAME_DURATION = 150;

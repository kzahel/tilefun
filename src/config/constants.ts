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

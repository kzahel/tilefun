import { CHUNK_SIZE_PX, PIXEL_SCALE } from "../config/constants.js";

export class Camera {
  x = 0;
  y = 0;
  viewportWidth = 0;
  viewportHeight = 0;

  setViewport(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  /** Convert world-pixel coordinates to screen (canvas) coordinates. */
  worldToScreen(wx: number, wy: number): { sx: number; sy: number } {
    return {
      sx: (wx - this.x) * PIXEL_SCALE + this.viewportWidth / 2,
      sy: (wy - this.y) * PIXEL_SCALE + this.viewportHeight / 2,
    };
  }

  /** Convert screen (canvas) coordinates to world-pixel coordinates. */
  screenToWorld(sx: number, sy: number): { wx: number; wy: number } {
    return {
      wx: (sx - this.viewportWidth / 2) / PIXEL_SCALE + this.x,
      wy: (sy - this.viewportHeight / 2) / PIXEL_SCALE + this.y,
    };
  }

  /** Smoothly move toward a target position using linear interpolation. */
  follow(targetX: number, targetY: number, lerpFactor: number): void {
    this.x += (targetX - this.x) * lerpFactor;
    this.y += (targetY - this.y) * lerpFactor;

    // Snap to target when very close to avoid infinite asymptotic creep
    const snapThreshold = 1 / PIXEL_SCALE;
    if (Math.abs(this.x - targetX) < snapThreshold) this.x = targetX;
    if (Math.abs(this.y - targetY) < snapThreshold) this.y = targetY;

    // Round camera to pixel grid so all Math.floor'd screen positions
    // move in lockstep — prevents 1px jitter between tiles and entities
    this.x = Math.round(this.x * PIXEL_SCALE) / PIXEL_SCALE;
    this.y = Math.round(this.y * PIXEL_SCALE) / PIXEL_SCALE;
  }

  /** Get the range of chunk coordinates visible in the current viewport. */
  getVisibleChunkRange(): {
    minCx: number;
    minCy: number;
    maxCx: number;
    maxCy: number;
  } {
    const topLeft = this.screenToWorld(0, 0);
    const bottomRight = this.screenToWorld(this.viewportWidth, this.viewportHeight);

    return {
      minCx: Math.floor(topLeft.wx / CHUNK_SIZE_PX),
      minCy: Math.floor(topLeft.wy / CHUNK_SIZE_PX),
      maxCx: Math.floor(bottomRight.wx / CHUNK_SIZE_PX),
      maxCy: Math.floor(bottomRight.wy / CHUNK_SIZE_PX),
    };
  }
}

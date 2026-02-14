import { CHUNK_SIZE_PX, PIXEL_SCALE } from "../config/constants.js";

export class Camera {
  x = 0;
  y = 0;
  viewportWidth = 0;
  viewportHeight = 0;
  zoom = 1;

  /** Previous position (before last update tick), for render interpolation. */
  prevX = 0;
  prevY = 0;

  /** Actual position saved during interpolation, restored after render. */
  private actualX = 0;
  private actualY = 0;

  /** Effective pixel scale (base scale * zoom). */
  get scale(): number {
    return PIXEL_SCALE * this.zoom;
  }

  setViewport(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  /** Convert world-pixel coordinates to screen (canvas) coordinates. */
  worldToScreen(wx: number, wy: number): { sx: number; sy: number } {
    return {
      sx: (wx - this.x) * this.scale + this.viewportWidth / 2,
      sy: (wy - this.y) * this.scale + this.viewportHeight / 2,
    };
  }

  /** Convert screen (canvas) coordinates to world-pixel coordinates. */
  screenToWorld(sx: number, sy: number): { wx: number; wy: number } {
    return {
      wx: (sx - this.viewportWidth / 2) / this.scale + this.x,
      wy: (sy - this.viewportHeight / 2) / this.scale + this.y,
    };
  }

  /** Smoothly move toward a target position using linear interpolation. */
  follow(targetX: number, targetY: number, lerpFactor: number): void {
    this.x += (targetX - this.x) * lerpFactor;
    this.y += (targetY - this.y) * lerpFactor;

    // Snap to target when very close to avoid infinite asymptotic creep
    const s = this.scale;
    const snapThreshold = 1 / s;
    if (Math.abs(this.x - targetX) < snapThreshold) this.x = targetX;
    if (Math.abs(this.y - targetY) < snapThreshold) this.y = targetY;
  }

  /** Save current position as previous (call at start of each update tick). */
  savePrev(): void {
    this.prevX = this.x;
    this.prevY = this.y;
  }

  /**
   * Temporarily set camera position to interpolated value for rendering.
   * Call restoreActual() after rendering to restore the true position.
   */
  applyInterpolation(alpha: number): void {
    this.actualX = this.x;
    this.actualY = this.y;
    this.x = this.prevX + (this.x - this.prevX) * alpha;
    this.y = this.prevY + (this.y - this.prevY) * alpha;
  }

  /** Restore the true (post-update) camera position after rendering. */
  restoreActual(): void {
    this.x = this.actualX;
    this.y = this.actualY;
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

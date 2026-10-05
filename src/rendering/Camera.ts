import { CHUNK_SIZE_PX, PIXEL_SCALE } from "../config/constants.js";
import { advanceCameraFollow, type CameraFollowState } from "./CameraFollow.js";
import { projectWorld, unprojectPlane } from "./Projection.js";

export class Camera {
  x = 0;
  y = 0;
  viewportWidth = 0;
  viewportHeight = 0;
  zoom = 1;

  /** True until the first follow() call, so the camera snaps instead of lerping. */
  private firstFollow = true;

  /** Previous position (before last update tick), for render interpolation. */
  prevX = 0;
  prevY = 0;

  /** Screen shake state. */
  private shakeIntensity = 0;
  private shakeDecay = 0.9;
  shakeOffsetX = 0;
  shakeOffsetY = 0;

  /** Actual position saved during interpolation, restored after render. */
  private actualX = 0;
  private actualY = 0;
  private presentedFollow: CameraFollowState | null = null;
  private presentedDomain = "";

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
    return projectWorld(this, wx, wy);
  }

  /** Convert screen (canvas) coordinates to world-pixel coordinates. */
  screenToWorld(sx: number, sy: number): { wx: number; wy: number } {
    return unprojectPlane(this, sx, sy);
  }

  /** Immediately set camera position (e.g. restoring from HMR state). */
  snapTo(x: number, y: number): void {
    this.presentedFollow = null;
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.firstFollow = false;
  }

  /** Make the next follow() call snap instead of lerping (e.g. after switching worlds). */
  requestSnap(): void {
    this.presentedFollow = null;
    this.firstFollow = true;
  }

  /** Smoothly move toward a target position using linear interpolation. */
  follow(targetX: number, targetY: number, lerpFactor: number): void {
    if (this.firstFollow) {
      this.firstFollow = false;
      this.x = targetX;
      this.y = targetY;
      this.prevX = targetX;
      this.prevY = targetY;
      return;
    }

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

  /** Render-time follow, driven only by explicit time and the displayed target. */
  presentFollow(time: number, targetX: number, targetY: number, domain = "remote"): void {
    if (this.presentedFollow && domain !== this.presentedDomain) {
      // Ground/support transitions change clock ownership, not camera position.
      this.presentedFollow = { ...this.presentedFollow, time, targetX, targetY };
    }
    this.presentedDomain = domain;
    this.presentedFollow = advanceCameraFollow(this.presentedFollow, time, targetX, targetY);
    this.x = this.presentedFollow.x;
    this.y = this.presentedFollow.y;
    this.actualX = this.x;
    this.actualY = this.y;
  }

  /** Restore the true (post-update) camera position after rendering. */
  restoreActual(): void {
    this.x = this.actualX;
    this.y = this.actualY;
  }

  /** Trigger a screen shake effect. */
  shake(intensity: number): void {
    this.shakeIntensity = intensity;
  }

  /** Update shake offsets (call each tick). */
  updateShake(): void {
    if (this.shakeIntensity > 0.1) {
      this.shakeOffsetX = (Math.random() - 0.5) * this.shakeIntensity * 2;
      this.shakeOffsetY = (Math.random() - 0.5) * this.shakeIntensity * 2;
      this.shakeIntensity *= this.shakeDecay;
    } else {
      this.shakeIntensity = 0;
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
    }
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

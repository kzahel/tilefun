import { canvasPoint, inRegion, type ViewRegion, withCssPixels } from "./ViewRect.js";

const BASE_RADIUS = 60;
const THUMB_RADIUS = 28;
const DEAD_ZONE = 10;
const MAX_DISTANCE = 50;
const BASE_ALPHA = 0.25;
const THUMB_ALPHA = 0.4;
const TAP_MAX_DURATION_MS = 300;
const TAP_MAX_DISTANCE = 15;

/** Base and thumb are CSS pixels relative to the canvas (see ViewRect). */
interface JoystickState {
  touchId: number;
  baseX: number;
  baseY: number;
  thumbX: number;
  thumbY: number;
  startTime: number;
  clientX: number;
  clientY: number;
}

export class TouchJoystick {
  private state: JoystickState | null = null;
  private canvas: HTMLCanvasElement;
  enabled = true;
  /** Called when a short tap (no drag) is detected. Coordinates are client-space. */
  onTap: ((clientX: number, clientY: number) => void) | null = null;
  /** Touch IDs claimed by other systems (e.g. TouchButtons). Joystick ignores these. */
  claimedTouches: Set<number> | null = null;
  /** Only touches starting in this region (CSS px of the canvas) steer; null = whole canvas. */
  region: ViewRegion | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  attach(): void {
    this.canvas.addEventListener("touchstart", this.onTouchStart, { passive: false });
    this.canvas.addEventListener("touchmove", this.onTouchMove, { passive: false });
    this.canvas.addEventListener("touchend", this.onTouchEnd, { passive: false });
    this.canvas.addEventListener("touchcancel", this.onTouchEnd, { passive: false });
  }

  detach(): void {
    this.canvas.removeEventListener("touchstart", this.onTouchStart);
    this.canvas.removeEventListener("touchmove", this.onTouchMove);
    this.canvas.removeEventListener("touchend", this.onTouchEnd);
    this.canvas.removeEventListener("touchcancel", this.onTouchEnd);
    this.state = null;
  }

  isActive(): boolean {
    return this.enabled && this.state !== null;
  }

  reset(): void {
    this.state = null;
  }

  /** Get analog movement vector. dx/dy in [-1, 1], magnitude capped at 1. */
  getMovement(): { dx: number; dy: number } {
    if (!this.state) return { dx: 0, dy: 0 };

    const rawDx = (this.state.thumbX - this.state.baseX) / MAX_DISTANCE;
    const rawDy = (this.state.thumbY - this.state.baseY) / MAX_DISTANCE;
    const mag = Math.hypot(rawDx, rawDy);

    if (mag < DEAD_ZONE / MAX_DISTANCE) return { dx: 0, dy: 0 };
    if (mag > 1) return { dx: rawDx / mag, dy: rawDy / mag };
    return { dx: rawDx, dy: rawDy };
  }

  /** Draw the joystick overlay on the canvas. */
  draw(ctx: CanvasRenderingContext2D): void {
    const state = this.state;
    if (!this.enabled || !state) return;
    withCssPixels(ctx, this.canvas, () => this.drawState(ctx, state));
  }

  private drawState(ctx: CanvasRenderingContext2D, state: JoystickState): void {
    ctx.save();

    // Base circle
    ctx.globalAlpha = BASE_ALPHA;
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(state.baseX, state.baseY, BASE_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Thumb circle
    ctx.globalAlpha = THUMB_ALPHA;
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(state.thumbX, state.thumbY, THUMB_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** Simulate a touch start (for testing). */
  simulateTouchStart(x: number, y: number): void {
    this.state = {
      touchId: -1,
      baseX: x,
      baseY: y,
      thumbX: x,
      thumbY: y,
      startTime: performance.now(),
      clientX: x,
      clientY: y,
    };
  }

  /** Simulate thumb movement (for testing). */
  simulateTouchMove(x: number, y: number): void {
    if (!this.state) return;
    this.clampThumb(x, y);
  }

  /** Simulate touch end (for testing). */
  simulateTouchEnd(): void {
    this.state = null;
  }

  private clampThumb(x: number, y: number): void {
    if (!this.state) return;
    const dx = x - this.state.baseX;
    const dy = y - this.state.baseY;
    const dist = Math.hypot(dx, dy);
    if (dist > MAX_DISTANCE) {
      this.state.thumbX = this.state.baseX + (dx / dist) * MAX_DISTANCE;
      this.state.thumbY = this.state.baseY + (dy / dist) * MAX_DISTANCE;
    } else {
      this.state.thumbX = x;
      this.state.thumbY = y;
    }
  }

  private onTouchStart = (e: TouchEvent): void => {
    if (!this.enabled) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (!touch) continue;
      // Skip touches claimed by other systems (e.g. on-screen buttons)
      if (this.claimedTouches?.has(touch.identifier)) continue;
      const at = canvasPoint(this.canvas, touch.clientX, touch.clientY);
      if (!this.state && (!this.region || inRegion(this.region, at))) {
        // First finger: joystick
        this.state = {
          touchId: touch.identifier,
          baseX: at.x,
          baseY: at.y,
          thumbX: at.x,
          thumbY: at.y,
          startTime: performance.now(),
          clientX: touch.clientX,
          clientY: touch.clientY,
        };
        e.preventDefault();
      }
    }
  };

  private onTouchMove = (e: TouchEvent): void => {
    if (!this.state) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch && touch.identifier === this.state.touchId) {
        const at = canvasPoint(this.canvas, touch.clientX, touch.clientY);
        this.clampThumb(at.x, at.y);
        e.preventDefault();
        return;
      }
    }
  };

  private onTouchEnd = (e: TouchEvent): void => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (!touch) continue;
      if (this.state && touch.identifier === this.state.touchId) {
        // Detect tap: short duration + minimal movement
        const elapsed = performance.now() - this.state.startTime;
        const dx = touch.clientX - this.state.clientX;
        const dy = touch.clientY - this.state.clientY;
        const moved = Math.hypot(dx, dy);
        if (
          e.type !== "touchcancel" &&
          elapsed < TAP_MAX_DURATION_MS &&
          moved < TAP_MAX_DISTANCE &&
          this.onTap
        ) {
          this.onTap(this.state.clientX, this.state.clientY);
        }
        this.state = null;
        e.preventDefault();
      }
    }
  };
}

const BASE_RADIUS = 60;
const THUMB_RADIUS = 28;
const DEAD_ZONE = 10;
const MAX_DISTANCE = 50;
const BASE_ALPHA = 0.25;
const THUMB_ALPHA = 0.4;
const TAP_MAX_DURATION_MS = 300;
const TAP_MAX_DISTANCE = 15;

interface JoystickState {
  touchId: number;
  baseX: number;
  baseY: number;
  thumbX: number;
  thumbY: number;
  startTime: number;
}

export class TouchJoystick {
  private state: JoystickState | null = null;
  private canvas: HTMLCanvasElement;
  /** Called when a short tap (no drag) is detected. Coordinates are client-space. */
  onTap: ((clientX: number, clientY: number) => void) | null = null;

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
    return this.state !== null;
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
    if (!this.state) return;
    ctx.save();

    // Base circle
    ctx.globalAlpha = BASE_ALPHA;
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(this.state.baseX, this.state.baseY, BASE_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Thumb circle
    ctx.globalAlpha = THUMB_ALPHA;
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(this.state.thumbX, this.state.thumbY, THUMB_RADIUS, 0, Math.PI * 2);
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
    if (this.state) return; // already tracking a touch
    const touch = e.changedTouches[0];
    if (touch) {
      this.state = {
        touchId: touch.identifier,
        baseX: touch.clientX,
        baseY: touch.clientY,
        thumbX: touch.clientX,
        thumbY: touch.clientY,
        startTime: performance.now(),
      };
      e.preventDefault();
    }
  };

  private onTouchMove = (e: TouchEvent): void => {
    if (!this.state) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch && touch.identifier === this.state.touchId) {
        this.clampThumb(touch.clientX, touch.clientY);
        e.preventDefault();
        return;
      }
    }
  };

  private onTouchEnd = (e: TouchEvent): void => {
    if (!this.state) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch && touch.identifier === this.state.touchId) {
        // Detect tap: short duration + minimal movement
        const elapsed = performance.now() - this.state.startTime;
        const dx = touch.clientX - this.state.baseX;
        const dy = touch.clientY - this.state.baseY;
        const moved = Math.hypot(dx, dy);
        if (elapsed < TAP_MAX_DURATION_MS && moved < TAP_MAX_DISTANCE && this.onTap) {
          this.onTap(this.state.baseX, this.state.baseY);
        }
        this.state = null;
        e.preventDefault();
        return;
      }
    }
  };
}

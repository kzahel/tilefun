/**
 * On-screen action buttons for touch/mobile play mode.
 * Renders 3 fixed-position buttons in the bottom-right corner:
 *   - A (Jump) — primary, bottom-right
 *   - R (Sprint) — left of A
 *   - B (Throw) — above, between A and R
 *
 * Button layout (triangle):
 *        [B]
 *   [R]      [A]
 */
const BTN_RADIUS = 28;
const HIT_RADIUS = 40; // larger hit area for small fingers
const MARGIN = 24;
const SPACING = 68;
const LABEL_FONT = "bold 14px sans-serif";
const ALPHA_IDLE = 0.2;
const ALPHA_PRESSED = 0.45;
const LABEL_ALPHA_IDLE = 0.45;
const LABEL_ALPHA_PRESSED = 0.75;

interface ButtonDef {
  label: string;
  pressed: boolean;
  touchId: number | null;
}

export class TouchButtons {
  enabled = true;
  driving = false;
  emergency = false;
  warning = false;
  emergencyState = 2;
  private mouseButton: number | null = null;
  private visibleButton(index: number): boolean {
    return !this.driving || index === 2 || this.emergency || (index === 1 && this.warning);
  }
  private canvas: HTMLCanvasElement;
  private buttons: ButtonDef[] = [
    { label: "A", pressed: false, touchId: null }, // jump
    { label: "B", pressed: false, touchId: null }, // throw
    { label: "R", pressed: false, touchId: null }, // sprint
  ];

  /** Touch IDs claimed by buttons (shared with TouchJoystick to avoid conflicts). */
  readonly claimedTouches = new Set<number>();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  get jumpPressed(): boolean {
    return this.enabled && (this.buttons[0]?.pressed ?? false);
  }

  get throwPressed(): boolean {
    return this.enabled && (this.buttons[1]?.pressed ?? false);
  }

  get sprintPressed(): boolean {
    return this.enabled && (this.buttons[2]?.pressed ?? false);
  }

  attach(): void {
    this.canvas.addEventListener("mousedown", this.onMouseDown);
    if (typeof window !== "undefined") {
      window.addEventListener("mouseup", this.onMouseUp);
      window.addEventListener("blur", this.onBlur);
    }
    this.canvas.addEventListener("touchstart", this.onTouchStart, {
      passive: false,
    });
    this.canvas.addEventListener("touchend", this.onTouchEnd, {
      passive: false,
    });
    this.canvas.addEventListener("touchcancel", this.onTouchEnd, {
      passive: false,
    });
  }

  detach(): void {
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    if (typeof window !== "undefined") {
      window.removeEventListener("mouseup", this.onMouseUp);
      window.removeEventListener("blur", this.onBlur);
    }
    this.canvas.removeEventListener("touchstart", this.onTouchStart);
    this.canvas.removeEventListener("touchend", this.onTouchEnd);
    this.canvas.removeEventListener("touchcancel", this.onTouchEnd);
    this.reset();
  }

  reset(): void {
    this.mouseButton = null;
    for (const btn of this.buttons) {
      btn.pressed = false;
      btn.touchId = null;
    }
    this.claimedTouches.clear();
  }

  /** Render buttons on the canvas. Only draws on touch-capable devices. */
  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.enabled) return;
    if (!this.driving && !isTouchDevice()) return;

    const positions = this.getPositions();
    for (let i = 0; i < this.buttons.length; i++) {
      const btn = this.buttons[i];
      const pos = positions[i];
      if (!btn || !pos || !this.visibleButton(i)) continue;

      ctx.save();
      // Circle
      ctx.globalAlpha = this.driving
        ? btn.pressed
          ? 0.65
          : 0.4
        : btn.pressed
          ? ALPHA_PRESSED
          : ALPHA_IDLE;
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, BTN_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.globalAlpha = this.driving ? 1 : btn.pressed ? LABEL_ALPHA_PRESSED : LABEL_ALPHA_IDLE;
      ctx.fillStyle = "white";
      ctx.font = LABEL_FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const label = this.driving
        ? i === 2
          ? "Fast"
          : i === 1
            ? this.emergencyState & 1
              ? this.warning
                ? "Beacon On"
                : "Siren On"
              : this.warning
                ? "Beacon Off"
                : "Siren Off"
            : (["Quiet", "EU", "US"][this.emergencyState >> 1] ?? "EU")
        : btn.label;
      ctx.fillText(label, pos.x, pos.y);
      if (this.driving) {
        ctx.font = "10px sans-serif";
        ctx.fillText(
          i === 2 ? "hold · Shift" : i === 1 ? "toggle · B" : "style · Space",
          pos.x,
          pos.y + 15,
        );
      }
      ctx.restore();
    }
  }

  /** Compute button center positions based on current canvas size. */
  private getPositions(): { x: number; y: number }[] {
    const w = this.canvas.clientWidth || this.canvas.width;
    const h = this.canvas.clientHeight || this.canvas.height;

    // A (jump) — bottom-right
    const aX = w - MARGIN - BTN_RADIUS;
    const aY = h - MARGIN - BTN_RADIUS;
    // R (sprint) — left of A
    const rX = aX - SPACING;
    const rY = aY;
    // B (throw) — above, centered between A and R
    const bX = (aX + rX) / 2;
    const bY = aY - SPACING;

    return [
      { x: aX, y: aY }, // A = jump
      { x: bX, y: bY }, // B = throw
      { x: rX, y: rY }, // R = sprint
    ];
  }

  private hitTest(x: number, y: number): number {
    const positions = this.getPositions();
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      if (!pos || !this.visibleButton(i)) continue;
      const dx = x - pos.x;
      const dy = y - pos.y;
      if (dx * dx + dy * dy <= HIT_RADIUS * HIT_RADIUS) {
        return i;
      }
    }
    return -1;
  }

  private onBlur = (): void => this.reset();
  private onMouseDown = (event: MouseEvent): void => {
    if (!this.enabled || !this.driving || event.button !== 0) return;
    const rect = this.canvas.getBoundingClientRect();
    const index = this.hitTest(event.clientX - rect.left, event.clientY - rect.top);
    if (index < 0 || this.buttons[index]?.touchId !== null) return;
    const button = this.buttons[index];
    if (!button) return;
    this.mouseButton = index;
    button.pressed = true;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  private onMouseUp = (): void => {
    if (this.mouseButton !== null) {
      const button = this.buttons[this.mouseButton];
      if (button && button.touchId === null) button.pressed = false;
      this.mouseButton = null;
    }
  };
  private onTouchStart = (e: TouchEvent): void => {
    if (!this.enabled) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (!touch) continue;
      const btnIdx = this.hitTest(
        touch.clientX - (this.canvas.getBoundingClientRect?.().left ?? 0),
        touch.clientY - (this.canvas.getBoundingClientRect?.().top ?? 0),
      );
      if (btnIdx < 0) continue;
      const btn = this.buttons[btnIdx];
      if (!btn) continue;
      if (btn.touchId !== null) continue; // already held by another finger
      btn.touchId = touch.identifier;
      btn.pressed = true;
      this.claimedTouches.add(touch.identifier);
      e.preventDefault();
    }
  };

  private onTouchEnd = (e: TouchEvent): void => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (!touch) continue;
      for (const btn of this.buttons) {
        if (btn.touchId === touch.identifier) {
          btn.pressed = false;
          btn.touchId = null;
          this.claimedTouches.delete(touch.identifier);
          e.preventDefault();
          break;
        }
      }
    }
  };
}

function isTouchDevice(): boolean {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

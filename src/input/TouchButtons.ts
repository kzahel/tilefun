import { inputHint } from "./InputHints.js";

/** Named action paddles, shared by touch, mouse, keyboard and controller hints. */
const BTN_RADIUS = 28;
const HIT_RADIUS = 32; // larger hit area for small fingers
const MARGIN = 24;
const SPACING = 68;
const LABEL_FONT = "bold 14px sans-serif";

interface ButtonDef {
  label: string;
  pressed: boolean;
  touchId: number | null;
}

export class TouchButtons {
  enabled = true;
  driving = false;
  emergency = false;
  train = false;
  warning = false;
  emergencyState = 2;
  private mouseButton: number | null = null;
  private hornPressLatched = false;
  consumeHornPress(): boolean {
    const pressed = this.enabled && this.driving && this.hornPressLatched;
    this.hornPressLatched = false;
    return pressed;
  }
  private visibleButton(index: number): boolean {
    if (index === 2) return true; // Fast always occupies the same slot.
    if (!this.driving) return index < 2;
    return (
      index === 3 ||
      (index === 4 && (this.emergency || this.warning)) ||
      (index === 5 && this.emergency)
    );
  }
  private canvas: HTMLCanvasElement;
  private buttons: ButtonDef[] = [
    { label: "Jump", pressed: false, touchId: null }, // jump
    { label: "Throw", pressed: false, touchId: null }, // throw
    { label: "Fast", pressed: false, touchId: null }, // sprint
    { label: "Horn", pressed: false, touchId: null },
    { label: "Lights", pressed: false, touchId: null },
    { label: "Style", pressed: false, touchId: null },
    { label: "Reverse", pressed: false, touchId: null },
  ];

  /** Touch IDs claimed by buttons (shared with TouchJoystick to avoid conflicts). */
  readonly claimedTouches = new Set<number>();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  get reversePressed(): boolean {
    return this.enabled && this.driving && !this.train && !!this.buttons[6]?.pressed;
  }
  get lightsPressed(): boolean {
    return this.enabled && !!this.buttons[4]?.pressed;
  }
  get stylePressed(): boolean {
    return this.enabled && !!this.buttons[5]?.pressed;
  }

  get hornPressed(): boolean {
    return this.enabled && this.driving && (this.buttons[3]?.pressed ?? false);
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
    this.hornPressLatched = false;
    this.mouseButton = null;
    for (const btn of this.buttons) {
      btn.pressed = false;
      btn.touchId = null;
    }
    this.claimedTouches.clear();
  }

  /** Touch actions on foot; driving actions also remain available with a mouse. */
  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.enabled) return;

    const positions = this.getPositions();
    for (let i = 0; i < this.buttons.length; i++) {
      const btn = this.buttons[i];
      const pos = positions[i];
      if (!btn || !pos || !this.visibleButton(i)) continue;

      ctx.save();
      ctx.globalAlpha = btn.pressed ? 0.95 : 0.8;
      ctx.fillStyle = btn.pressed ? "#496853" : "#203a35";
      ctx.beginPath();
      ctx.roundRect(pos.x - 32, pos.y - 26, 64, 52, 14);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#fff4d5";
      ctx.font = LABEL_FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const label =
        i === 3 && this.train
          ? "Whistle"
          : i === 4
            ? this.warning
              ? "Beacon"
              : "Siren"
            : btn.label;
      ctx.fillText(label, pos.x, pos.y - 5);
      const hints = [
        ["Space", "A"],
        ["B", "X"],
        ["Shift", "RT"],
        ["H", "RB"],
        ["L", "D↑"],
        ["K", "D→"],
        ["R", "LT"],
      ];
      const hint = hints[i];
      const badge = hint ? inputHint(hint[0] ?? "", hint[1] ?? "") : "";
      ctx.font = "10px sans-serif";
      ctx.fillText(
        i === 4
          ? `${this.emergencyState & 1 ? "On" : "Off"}${badge ? ` · ${badge}` : ""}`
          : i === 5
            ? `${["Quiet", "EU", "US"][this.emergencyState >> 1] ?? ""} · ${badge || "Tap"}`
            : badge || "Hold",
        pos.x,
        pos.y + 13,
      );
      ctx.restore();
    }
  }

  /** Compute button center positions based on current canvas size. */
  getPositions(): { x: number; y: number }[] {
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
      { x: aX, y: aY - SPACING }, // horn
      { x: rX, y: aY - SPACING }, // lights
      { x: rX, y: aY - 2 * SPACING }, // style
      { x: aX, y: aY }, // reverse
    ];
  }

  private hitTest(x: number, y: number): number {
    const positions = this.getPositions();
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      if (!pos || !this.visibleButton(i)) continue;
      const dx = x - pos.x;
      const dy = y - pos.y;
      if (Math.abs(dx) <= HIT_RADIUS && Math.abs(dy) <= 26) {
        return i;
      }
    }
    return -1;
  }

  private onBlur = (): void => this.reset();
  private onMouseDown = (event: MouseEvent): void => {
    if (!this.enabled || event.button !== 0) return;
    const rect = this.canvas.getBoundingClientRect();
    const index = this.hitTest(event.clientX - rect.left, event.clientY - rect.top);
    if (index < 0 || this.buttons[index]?.touchId !== null) return;
    const button = this.buttons[index];
    if (!button) return;
    this.mouseButton = index;
    button.pressed = true;
    if (index === 3) this.hornPressLatched = true;
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
      if (btnIdx === 3 && this.driving) this.hornPressLatched = true;
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

const SECOND_FINGER_MS = 200;
const MOVE_THRESHOLD = 8;
const MIN_DISTANCE = 20;

/** Two fresh world fingers may take over a neutral joystick, never a moving one. */
export class TouchPinch {
  private first: { id: number; x: number; y: number; time: number } | null = null;
  private gesture: { ids: number[]; distance: number; zoom: number } | null = null;
  private owned = new Set<number>();

  constructor(
    private canvas: HTMLCanvasElement,
    private claimed: Set<number>,
    private allowed: () => boolean,
    private joystickMoving: () => boolean,
    private getZoom: () => number,
    private setZoom: (zoom: number) => void,
    private begin: () => void,
  ) {}

  attach(): void {
    // Attach after action buttons, before world movement handlers.
    this.canvas.addEventListener("touchstart", this.start, { passive: false });
    this.canvas.addEventListener("touchmove", this.move, { passive: false });
    this.canvas.addEventListener("touchend", this.end, { passive: false });
    this.canvas.addEventListener("touchcancel", this.cancel, { passive: false });
  }

  detach(): void {
    this.canvas.removeEventListener("touchstart", this.start);
    this.canvas.removeEventListener("touchmove", this.move);
    this.canvas.removeEventListener("touchend", this.end);
    this.canvas.removeEventListener("touchcancel", this.cancel);
    this.reset();
  }

  reset(): void {
    this.first = null;
    this.gesture = null;
    for (const id of this.owned) this.claimed.delete(id);
    this.owned.clear();
  }

  private claim(touches: Touch[]): void {
    for (const t of touches) {
      if (t.target !== this.canvas || this.claimed.has(t.identifier)) continue;
      this.owned.add(t.identifier);
      this.claimed.add(t.identifier);
    }
  }

  private start = (e: TouchEvent): void => {
    if (this.owned.size) {
      // Extra fingers stop zoom; quarantine world contacts until lifted.
      this.gesture = null;
      this.claim(Array.from(e.changedTouches));
      e.preventDefault();
      return;
    }
    const touches = Array.from(e.touches);
    if (
      !this.allowed() ||
      this.joystickMoving() ||
      touches.some((t) => t.target !== this.canvas || this.claimed.has(t.identifier))
    ) {
      this.first = null;
      return;
    }
    if (touches.length === 1) {
      const t = touches[0];
      if (t) this.first = { id: t.identifier, x: t.clientX, y: t.clientY, time: performance.now() };
      return;
    }
    const first = this.first;
    this.first = null;
    // Simultaneous fingers are also valid. A held joystick cannot be reclaimed.
    if (
      touches.length !== 2 ||
      (first && performance.now() - first.time > SECOND_FINGER_MS) ||
      (!first && e.changedTouches.length !== 2)
    )
      return;
    const [a, b] = touches;
    if (!a || !b) return;
    const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    if (distance < MIN_DISTANCE) return;
    const zoom = this.getZoom();
    this.begin();
    this.claim(touches);
    this.gesture = { ids: [a.identifier, b.identifier], distance, zoom };
    e.preventDefault();
  };

  private move = (e: TouchEvent): void => {
    if (this.first) {
      const t = Array.from(e.changedTouches).find((t) => t.identifier === this.first?.id);
      if (t && Math.hypot(t.clientX - this.first.x, t.clientY - this.first.y) > MOVE_THRESHOLD)
        this.first = null;
    }
    const g = this.gesture;
    if (!g) return;
    if (!this.allowed() || this.joystickMoving() || e.touches.length !== 2) {
      this.gesture = null;
      return;
    }
    const [a, b] = g.ids.map((id) => Array.from(e.touches).find((t) => t.identifier === id));
    if (!a || !b) return;
    const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    this.setZoom(Math.max(0.05, Math.min(3, (g.zoom * distance) / g.distance)));
    e.preventDefault();
  };

  private end = (e: TouchEvent): void => {
    this.first = null;
    this.gesture = null;
    for (const t of Array.from(e.changedTouches)) {
      if (this.owned.delete(t.identifier)) {
        this.claimed.delete(t.identifier);
        e.preventDefault();
      }
    }
  };

  private cancel = (e: TouchEvent): void => {
    this.end(e);
    // Remaining fingers stay claimed so a canceled gesture cannot restart movement.
  };
}

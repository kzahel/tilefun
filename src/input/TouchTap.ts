import type { TapTarget } from "./TapMovement.js";

/** Completed world taps. Resolve at contact start, before fullscreen or camera changes. */
export class TouchTap {
  private contact: { id: number; x: number; y: number; time: number; target: TapTarget } | null =
    null;
  private rejected = false;
  constructor(
    private canvas: HTMLCanvasElement,
    private claimed: Set<number>,
    private resolve: (x: number, y: number) => TapTarget | null,
    private tap: (target: TapTarget) => void,
  ) {}
  attach(): void {
    this.canvas.addEventListener("touchstart", this.start, { passive: false });
    this.canvas.addEventListener("touchmove", this.move, { passive: false });
    this.canvas.addEventListener("touchend", this.end, { passive: false });
    this.canvas.addEventListener("touchcancel", this.cancelEvent, { passive: false });
  }
  detach(): void {
    this.canvas.removeEventListener("touchstart", this.start);
    this.canvas.removeEventListener("touchmove", this.move);
    this.canvas.removeEventListener("touchend", this.end);
    this.canvas.removeEventListener("touchcancel", this.cancelEvent);
    this.reset();
  }
  reset(): void {
    this.contact = null;
    this.rejected = false;
  }
  private start = (e: TouchEvent): void => {
    const world = Array.from(e.touches).filter((t) => !this.claimed.has(t.identifier));
    if (world.length > 1) {
      this.contact = null;
      this.rejected = true;
      return;
    }
    if (world.length === 0) return;
    if (this.rejected || this.contact) return;
    const t = world[0];
    if (!t) return;
    const target = this.resolve(t.clientX, t.clientY);
    if (!target) return;
    this.contact = {
      id: t.identifier,
      x: t.clientX,
      y: t.clientY,
      time: performance.now(),
      target,
    };
    e.preventDefault();
  };
  private move = (e: TouchEvent): void => {
    const c = this.contact;
    if (!c) return;
    for (const t of Array.from(e.changedTouches))
      if (t.identifier === c.id) {
        if (Math.hypot(t.clientX - c.x, t.clientY - c.y) > 20) {
          this.contact = null;
          this.rejected = true;
        }
        e.preventDefault();
      }
  };
  private end = (e: TouchEvent): void => {
    const c = this.contact;
    if (c)
      for (const t of Array.from(e.changedTouches))
        if (t.identifier === c.id) {
          this.contact = null;
          e.preventDefault();
          if (
            !this.rejected &&
            performance.now() - c.time <= 800 &&
            Math.hypot(t.clientX - c.x, t.clientY - c.y) <= 20
          )
            this.tap(c.target);
        }
    if (e.touches.length === 0) this.reset();
  };
  private cancelEvent = (e: TouchEvent): void => {
    this.contact = null;
    this.rejected = e.touches.length > 0;
  };
}

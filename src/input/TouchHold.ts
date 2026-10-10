import { TILE_SIZE } from "../config/constants.js";
import type { Movement } from "./ActionManager.js";
import type { TapTarget } from "./TapMovement.js";

interface Contact {
  x: number;
  y: number;
}

/** Newest world contact steers while held; axes still use ordinary prediction/authority. */
export class TouchHold {
  private contacts = new Map<number, Contact>();
  private mouse: Contact | null = null;
  private lastTouchAt = -Infinity;
  private lastPosition: { wx: number; wy: number } | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private claimed: Set<number>,
    private resolve: (x: number, y: number) => TapTarget | null,
  ) {}

  attach(): void {
    this.canvas.addEventListener("touchstart", this.start, { passive: false });
    this.canvas.addEventListener("touchmove", this.move, { passive: false });
    this.canvas.addEventListener("touchend", this.end, { passive: false });
    this.canvas.addEventListener("touchcancel", this.cancel, { passive: false });
    this.canvas.addEventListener("mousedown", this.mouseDown);
    window.addEventListener("mousemove", this.mouseMove);
    window.addEventListener("mouseup", this.mouseUp);
  }

  detach(): void {
    this.canvas.removeEventListener("touchstart", this.start);
    this.canvas.removeEventListener("touchmove", this.move);
    this.canvas.removeEventListener("touchend", this.end);
    this.canvas.removeEventListener("touchcancel", this.cancel);
    this.canvas.removeEventListener("mousedown", this.mouseDown);
    window.removeEventListener("mousemove", this.mouseMove);
    window.removeEventListener("mouseup", this.mouseUp);
    this.reset();
  }

  reset(): void {
    this.contacts.clear();
    this.mouse = null;
    this.lastPosition = null;
  }

  sample(
    position: { wx: number; wy: number },
    manual: Movement,
    train = false,
    slowWithin = 0,
  ): Movement {
    if (
      manual.dx ||
      manual.dy ||
      (this.lastPosition &&
        Math.hypot(position.wx - this.lastPosition.wx, position.wy - this.lastPosition.wy) >
          TILE_SIZE * 4)
    ) {
      this.reset();
      return manual;
    }
    const contact = Array.from(this.contacts.values()).at(-1) ?? this.mouse;
    if (!contact) return manual;
    // Resolve every sample against the latest presented view: holding a screen
    // direction keeps walking as the camera follows, rather than arriving at a tap.
    const target = this.resolve(contact.x, contact.y);
    if (!target) {
      this.reset();
      return manual;
    }
    this.lastPosition = { ...position };
    if (train) return { ...manual, dx: target.screenSide ?? 1, dy: 0 };
    const dx = target.wx - position.wx;
    const dy = target.wy - position.wy;
    const distance = Math.hypot(dx, dy);
    if (distance <= TILE_SIZE / 2) return manual;
    const scale = slowWithin > 0 ? Math.min(1, distance / slowWithin) : 1;
    return { ...manual, dx: (dx / distance) * scale, dy: (dy / distance) * scale };
  }

  private start = (e: TouchEvent): void => {
    this.lastTouchAt = performance.now();
    this.mouse = null;
    // Only changed contacts began on the canvas. e.touches also contains fingers
    // held on DOM menus/buttons, which must never become movement contacts.
    for (const t of Array.from(e.changedTouches)) {
      if (this.claimed.has(t.identifier) || !this.resolve(t.clientX, t.clientY)) continue;
      this.contacts.set(t.identifier, { x: t.clientX, y: t.clientY });
      e.preventDefault();
    }
  };

  private move = (e: TouchEvent): void => {
    for (const t of Array.from(e.changedTouches)) {
      const contact = this.contacts.get(t.identifier);
      if (!contact) continue;
      contact.x = t.clientX;
      contact.y = t.clientY;
      e.preventDefault();
    }
  };

  private end = (e: TouchEvent): void => {
    this.lastTouchAt = performance.now();
    for (const t of Array.from(e.changedTouches))
      if (this.contacts.delete(t.identifier)) e.preventDefault();
    if (!this.contacts.size) this.lastPosition = null;
  };

  private cancel = (): void => {
    this.lastTouchAt = performance.now();
    this.reset();
  };

  private mouseDown = (e: MouseEvent): void => {
    if (
      e.button !== 0 ||
      performance.now() - this.lastTouchAt < 1000 ||
      !this.resolve(e.clientX, e.clientY)
    )
      return;
    this.mouse = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  };

  private mouseMove = (e: MouseEvent): void => {
    if (!this.mouse) return;
    if (!(e.buttons & 1)) {
      this.mouseUp();
      return;
    }
    this.mouse = { x: e.clientX, y: e.clientY };
  };

  private mouseUp = (): void => {
    this.mouse = null;
    if (!this.contacts.size) this.lastPosition = null;
  };
}

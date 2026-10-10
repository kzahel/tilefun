import { TILE_SIZE } from "../config/constants.js";
import { unprojectPlane } from "../rendering/Projection.js";
import type { RenderView } from "../rendering/RenderFrame.js";
import type { Movement } from "./ActionManager.js";

export type TouchMovementMode = "tap" | "joystick";
export function touchMovementMode(value: unknown): TouchMovementMode {
  return value === "tap" ? "tap" : "joystick";
}
export interface TapTarget {
  wx: number;
  wy: number;
  wz: number;
}

/** Client intent only: prediction and authority still receive ordinary sampled axes. */
export class TapMovement {
  target: TapTarget | null = null;
  blockedTarget: TapTarget | null = null;
  blockedFade = 0;
  private bestDistance = Infinity;
  private stalled = 0;
  private lastPosition: { wx: number; wy: number } | null = null;
  private view: RenderView | null = null;
  private plane = 0;

  captureView(view: RenderView, plane: number): void {
    this.view = {
      x: view.x,
      y: view.y,
      zoom: view.zoom,
      viewportWidth: view.viewportWidth,
      viewportHeight: view.viewportHeight,
      pixelSnap: view.pixelSnap ?? false,
    };
    this.plane = plane;
  }
  resolve(canvas: HTMLCanvasElement, clientX: number, clientY: number): TapTarget | null {
    if (!this.view) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const p = unprojectPlane(
      this.view,
      ((clientX - rect.left) * this.view.viewportWidth) / rect.width,
      ((clientY - rect.top) * this.view.viewportHeight) / rect.height,
      this.plane,
    );
    return { ...p, wz: this.plane };
  }
  setTarget(target: TapTarget): void {
    this.cancel();
    this.target = { ...target };
  }
  cancel(): void {
    this.target = null;
    this.blockedTarget = null;
    this.blockedFade = 0;
    this.bestDistance = Infinity;
    this.stalled = 0;
    this.lastPosition = null;
  }
  sample(position: { wx: number; wy: number }, manual: Movement, dt: number): Movement {
    this.blockedFade = Math.max(0, this.blockedFade - dt);
    if (manual.dx || manual.dy) {
      this.cancel();
      return manual;
    }
    const target = this.target;
    if (!target) return manual;
    if (
      this.lastPosition &&
      Math.hypot(position.wx - this.lastPosition.wx, position.wy - this.lastPosition.wy) >
        TILE_SIZE * 4
    ) {
      this.cancel();
      return manual;
    }
    this.lastPosition = { ...position };
    const dx = target.wx - position.wx,
      dy = target.wy - position.wy;
    const distance = Math.hypot(dx, dy);
    if (distance <= TILE_SIZE / 2) {
      this.cancel();
      return manual;
    }
    if (distance < this.bestDistance - 0.5) {
      this.bestDistance = distance;
      this.stalled = 0;
    } else this.stalled += dt;
    if (this.stalled >= 0.75) {
      this.cancel();
      this.blockedTarget = target;
      this.blockedFade = 0.4;
      return manual;
    }
    return { ...manual, dx: dx / distance, dy: dy / distance };
  }
}

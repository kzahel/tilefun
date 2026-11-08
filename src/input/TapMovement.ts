import { TILE_SIZE } from "../config/constants.js";
import { unprojectPlane } from "../rendering/Projection.js";
import type { RenderView } from "../rendering/RenderFrame.js";
import type { Movement } from "../shared/Movement.js";
import { regionPoint, type ViewRegion } from "./ViewRect.js";

export type TouchMovementMode = "tap" | "hold" | "joystick";
export function touchMovementMode(value: unknown): TouchMovementMode {
  return value === "tap" || value === "hold" ? value : "joystick";
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
  private region: ViewRegion = { x: 0, y: 0, width: 0, height: 0 };
  private plane = 0;

  /** The view taps resolve through: seat 0's presented camera and its region of the
   * canvas (canvas pixels). A tap outside the region lands nowhere (226). */
  captureView(
    view: { readonly camera: RenderView; readonly region: ViewRegion },
    plane: number,
  ): void {
    const { camera, region } = view;
    this.view = {
      x: camera.x,
      y: camera.y,
      zoom: camera.zoom,
      viewportWidth: camera.viewportWidth,
      viewportHeight: camera.viewportHeight,
      pixelSnap: camera.pixelSnap ?? false,
    };
    this.region = { x: region.x, y: region.y, width: region.width, height: region.height };
    this.plane = plane;
  }
  /** `anywhere`: a held contact that started in the view keeps steering outside it. */
  resolve(
    canvas: HTMLCanvasElement,
    clientX: number,
    clientY: number,
    anywhere = false,
  ): TapTarget | null {
    if (!this.view) return null;
    const point = regionPoint(canvas, this.region, clientX, clientY, anywhere);
    if (!point) return null;
    const p = unprojectPlane(this.view, point.x, point.y, this.plane);
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
  sample(
    position: { wx: number; wy: number },
    manual: Movement,
    dt: number,
    slowWithin = 0,
  ): Movement {
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
    const scale = slowWithin > 0 ? Math.min(1, distance / slowWithin) : 1;
    return { ...manual, dx: (dx / distance) * scale, dy: (dy / distance) * scale };
  }
}

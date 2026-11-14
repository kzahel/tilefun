import type { Spritesheet } from "../assets/Spritesheet.js";
import {
  DEFAULT_VIEW_DISTANCE,
  type FirstPersonViewDistance,
  VIEW_DISTANCES,
} from "../config/firstPersonViewDistance.js";
import {
  angleDelta,
  cameraRelativeMovement,
  clampPitch,
  type FirstPersonLook,
  lookDirection,
  NORTH_YAW,
} from "../rendering/firstperson/FirstPersonCamera.js";
import type { FirstPersonView } from "../rendering/firstperson/FirstPersonView.js";
import type { RenderBackend } from "../rendering/RenderFrame.js";
import { SceneFrame } from "../rendering/SceneFrame.js";
import type { View } from "../session/View.js";

/** First-person readiness: the view meshes the loaded chunk directly. */
export const FIRST_PERSON_TERRAIN: Pick<RenderBackend, "isTerrainReady"> = {
  isTerrainReady: (chunk) => chunk !== undefined,
};

const MOUSE_RADIANS_PER_PIXEL = 0.0025;
const STICK_YAW_RATE = 2.6;
const STICK_PITCH_RATE = 1.6;
/** A seat without a look device turns with its left and right keys. */
const KEY_YAW_RATE = 2.4;
/** Driving cameras swing back behind the vehicle after this long without manual look. */
const VEHICLE_FOLLOW_DELAY_MS = 1500;

/** A seat's look device this tick: a stick (right is +dx, down is +dy). */
export interface LookStick {
  readonly dx: number;
  readonly dy: number;
}

/**
 * First person for a device's seats (229, per seat since 249). Each seat chooses
 * its view kind; a seat's view then carries its look (`View.look`) and draws
 * through its own 3D scene. This owner keeps the choices, the lazily loaded
 * scenes, the settings every 3D view shares, and seat 0's mouse look.
 *
 * `View.drawn3d` is the per-frame answer to "is this seat shown in first
 * person?". Camera-relative movement, look input, streaming interest and pointer
 * lock all follow it, so the fixed-view fallbacks (loading, a failed module, the
 * editor, lost graphics) keep ordinary controls.
 */
export class FirstPersonControl {
  /** Saved per player (Options); sets the fog end and each 3D view's streamed area. */
  viewDistance: FirstPersonViewDistance = DEFAULT_VIEW_DISTANCE;
  /** Sun and contact shadows (247); `r_fpshadows` and `?fpshadows=0` set it. */
  shadows = new URLSearchParams(location.search).get("fpshadows") !== "0";
  /** Captures only: raises every eye by this many world pixels for an overview. */
  lift = 0;
  /** Presentation storage for 3D views; their mesh poses never share the fixed view's. */
  readonly frame = new SceneFrame({
    allCars3d: new URLSearchParams(location.search).has("allcars3d"),
  });
  /** Seats that chose first person, with the heading their view starts at. */
  private readonly chosen = new Map<number, number>();
  private readonly scenes = new Map<View, FirstPersonView>();
  private readonly lastManualLook = new WeakMap<View, number>();
  /** The device's views as last laid out. */
  private views: View[] = [];
  /** Seat 0's view, once the device has laid its views out. */
  private host: View | undefined;
  /** Returned as seat 0's look while its view is not in first person. */
  private readonly idle: FirstPersonLook = { yaw: NORTH_YAW, pitch: 0 };
  private create: ((sheets: ReadonlyMap<string, Spritesheet>) => FirstPersonView) | null = null;
  private loading = false;
  /** The view module failed to load; cleared when no seat is in first person. */
  private failed = false;
  private listening = false;
  private disposed = false;

  private readonly onClick = (): void => {
    const canvas = this.canvas();
    if (this.drawing && document.pointerLockElement !== canvas)
      void Promise.resolve(canvas.requestPointerLock?.()).catch(() => {});
  };
  private readonly onMouseMove = (event: MouseEvent): void => {
    if (!this.host || !this.drawing || document.pointerLockElement !== this.canvas()) return;
    this.turn(
      this.host,
      event.movementX * MOUSE_RADIANS_PER_PIXEL,
      -event.movementY * MOUSE_RADIANS_PER_PIXEL,
    );
  };

  /** Lazy sources: the client creates this before its canvas and sheets exist.
   * `canvas` is the input canvas (pointer lock); drawing goes through the render host. */
  constructor(
    private readonly canvas: () => HTMLCanvasElement,
    private readonly sheets: () => ReadonlyMap<string, Spritesheet>,
  ) {}

  /** Seat 0's choice. Entering faces `heading`; leaving releases its 3D scene. */
  setActive(value: boolean, heading = NORTH_YAW): void {
    this.setSeat(0, value, heading);
  }

  /** One seat's choice between the fixed view and first person. */
  setSeat(seat: number, value: boolean, heading = NORTH_YAW): void {
    if (value === this.chosen.has(seat) || (value && this.disposed)) return;
    if (value) this.chosen.set(seat, heading);
    else this.chosen.delete(seat);
    if (seat === 0) this.listen(value);
    // The seat's views change kind now, not at the next tick: a display frame may
    // come first (a menu over play draws without ticking).
    for (const view of this.views) if (view.seat === seat) this.apply(view);
    // A view the device has since replaced may still hold the seat's scene.
    if (!value)
      for (const view of [...this.scenes.keys()]) if (view.seat === seat) this.release(view);
    if (!this.chosen.size) this.failed = false;
  }

  seatActive(seat: number): boolean {
    return this.chosen.has(seat);
  }

  /** Seat 0 chose first person. */
  get active(): boolean {
    return this.chosen.has(0);
  }

  /** Seat 0's look. */
  get look(): FirstPersonLook {
    return this.host?.look ?? this.idle;
  }

  /** True when the latest play frame drew seat 0's view in first person. */
  get drawing(): boolean {
    return !!this.host?.drawn3d;
  }

  /**
   * Once per tick, after the device laid its views out: give each view its seat's
   * choice, forget seats and views that left, and set each 3D view's streaming
   * interest to the chosen view distance.
   */
  sync(views: readonly View[], seats: ReadonlySet<number>): void {
    this.views = [...views];
    this.host = views.find((view) => view.seat === 0) ?? this.host;
    for (const seat of [...this.chosen.keys()])
      if (seat !== 0 && !seats.has(seat)) this.setSeat(seat, false);
    for (const view of [...this.scenes.keys()]) if (!views.includes(view)) this.release(view);
    for (const view of views) this.apply(view);
  }

  private apply(view: View): void {
    const heading = this.chosen.get(view.seat);
    if (heading === undefined) {
      view.look = null;
      this.release(view);
    } else if (!view.look) view.look = { yaw: heading, pitch: 0 };
    // A guest's view is made again after leaving play: it resumes this heading.
    else this.chosen.set(view.seat, view.look.yaw);
    view.interestRadius = view.drawn3d ? VIEW_DISTANCES[this.viewDistance] : undefined;
  }

  private listen(value: boolean): void {
    if (value === this.listening) return;
    this.listening = value;
    const canvas = this.canvas();
    if (value) {
      canvas.addEventListener("click", this.onClick);
      document.addEventListener("mousemove", this.onMouseMove);
      return;
    }
    canvas.removeEventListener("click", this.onClick);
    document.removeEventListener("mousemove", this.onMouseMove);
    if (document.pointerLockElement === canvas) document.exitPointerLock();
  }

  /** Called by the play view after drawing a view's frame in first person. */
  markDrawn(view: View): void {
    view.drawn3d = true;
  }

  turn(view: View, yaw: number, pitch: number): void {
    if (!view.look) return;
    view.look.yaw += yaw;
    view.look.pitch = clampPitch(view.look.pitch + pitch);
    this.lastManualLook.set(view, performance.now());
  }

  /** Per tick for a view drawn in 3D: its seat's look stick, then a driving camera
   * eases back behind the vehicle. */
  update(view: View, dt: number, stick: LookStick, vehicleHeading?: number): void {
    const look = view.look;
    if (!look || !view.drawn3d) return;
    if (stick.dx || stick.dy)
      this.turn(view, stick.dx * STICK_YAW_RATE * dt, -stick.dy * STICK_PITCH_RATE * dt);
    const last = this.lastManualLook.get(view) ?? -Infinity;
    if (vehicleHeading !== undefined && performance.now() - last > VEHICLE_FOLLOW_DELAY_MS)
      look.yaw += angleDelta(vehicleHeading, look.yaw) * (1 - Math.exp(-3 * dt));
  }

  /** A seat with no look device turns with left and right instead of strafing. */
  keyTurn<T extends { dx: number; dy: number }>(view: View, input: T, dt: number): T {
    if (!view.look || !view.drawn3d || !input.dx) return input;
    this.turn(view, input.dx * KEY_YAW_RATE * dt, 0);
    return { ...input, dx: 0 };
  }

  /** Screen-style manual input rotated into world axes for the view's heading. */
  movement<T extends { dx: number; dy: number }>(view: View, input: T): T {
    if (!view.look || !view.drawn3d) return input;
    return { ...input, ...cameraRelativeMovement(input.dx, input.dy, view.look.yaw) };
  }

  /** Horizontal look direction, for actions that aim where the seat is looking. */
  forward(view: View): { x: number; y: number } | undefined {
    if (!view.look || !view.drawn3d) return undefined;
    const dir = lookDirection(view.look.yaw, 0);
    return { x: dir.x, y: dir.y };
  }

  /** The view's loaded 3D scene, or undefined while the module loads or after it
   * failed to load. */
  scene(view: View): FirstPersonView | undefined {
    if (!view.look || !this.chosen.has(view.seat) || this.disposed || this.failed) return undefined;
    const existing = this.scenes.get(view);
    if (existing) return existing;
    if (this.create) {
      const scene = this.create(this.sheets());
      this.scenes.set(view, scene);
      return scene;
    }
    if (!this.loading) {
      this.loading = true;
      import("../rendering/firstperson/FirstPersonView.js")
        .then(({ FirstPersonView }) => {
          this.create = (sheets) => new FirstPersonView(sheets);
        })
        .catch((error) => {
          this.failed = true;
          console.warn("[tilefun] First-person view unavailable", error);
        })
        .finally(() => {
          this.loading = false;
        });
    }
    return undefined;
  }

  /** Diagnostic counters from seat 0's loaded scene, for captures and benches. */
  get viewStats(): FirstPersonView["stats"] | undefined {
    const scene = this.host && this.scenes.get(this.host);
    return scene ? { ...scene.stats } : undefined;
  }

  /** The fixed view draws this view instead (loading, failed to load, graphics lost). */
  hide(view: View): void {
    view.drawn3d = false;
    if (view === this.host && document.pointerLockElement === this.canvas())
      document.exitPointerLock();
  }

  /** The fixed view draws every view (the editor and other scenes over play):
   * give back ordinary controls and the pointer. */
  hideView(): void {
    for (const view of this.scenes.keys()) view.drawn3d = false;
    if (this.host) this.hide(this.host);
  }

  private release(view: View): void {
    view.drawn3d = false;
    const scene = this.scenes.get(view);
    if (!scene) return;
    scene.dispose();
    this.scenes.delete(view);
    if (!this.scenes.size) this.frame.clear();
  }

  dispose(): void {
    if (this.disposed) return;
    for (const seat of [...this.chosen.keys()]) this.setSeat(seat, false);
    this.disposed = true;
    for (const view of [...this.scenes.keys()]) this.release(view);
    this.listen(false);
  }
}

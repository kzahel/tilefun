import type { Spritesheet } from "../assets/Spritesheet.js";
import {
  DEFAULT_VIEW_DISTANCE,
  type FirstPersonViewDistance,
} from "../config/firstPersonViewDistance.js";
import { controllerInput } from "../input/ControllerInput.js";
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

/** First-person readiness: the view meshes the loaded chunk directly. */
export const FIRST_PERSON_TERRAIN: Pick<RenderBackend, "isTerrainReady"> = {
  isTerrainReady: (chunk) => chunk !== undefined,
};

const MOUSE_RADIANS_PER_PIXEL = 0.0025;
const STICK_YAW_RATE = 2.6;
const STICK_PITCH_RATE = 1.6;
/** Driving cameras swing back behind the vehicle after this long without manual look. */
const VEHICLE_FOLLOW_DELAY_MS = 1500;

/**
 * Tactical 229 glue: one local first-person look and a lazily loaded view per
 * GameClient. Tactical 226 replaces this owner with per-seat input and a view's
 * camera policy; keep new behaviour out of here unless it is part of that seam.
 *
 * Look input: pointer lock + mouse on the UI canvas, or the controller right
 * stick (free during play; the virtual pointer only claims it in menus).
 *
 * `drawing` is the single per-frame answer to "is play shown in first person?".
 * Camera-relative movement, look input, the streaming zoom floor and pointer
 * lock all follow it, so the fixed-view fallbacks (loading, a failed view module,
 * editor) keep ordinary controls. Rooms are drawn in first person too (230).
 */
export class FirstPersonControl {
  active = false;
  readonly look: FirstPersonLook = { yaw: NORTH_YAW, pitch: 0 };
  /** Saved per player (Options); sets the fog end and the streamed area. */
  viewDistance: FirstPersonViewDistance = DEFAULT_VIEW_DISTANCE;
  /** Sun and contact shadows (247); `r_fpshadows` and `?fpshadows=0` set it. */
  shadows = new URLSearchParams(location.search).get("fpshadows") !== "0";
  /** Captures only: raises the eye by this many world pixels for an overview. */
  lift = 0;
  /** View-owned presentation storage; first-person mesh poses never share the fixed view's. */
  readonly frame = new SceneFrame({
    allCars3d: new URLSearchParams(location.search).has("allcars3d"),
  });
  private view: FirstPersonView | null = null;
  private loading = false;
  /** The view module failed to load; cleared when first person is toggled off. */
  private failed = false;
  private drawn = false;
  private lastManualLook = -Infinity;
  private disposed = false;

  private readonly onClick = (): void => {
    const canvas = this.canvas();
    if (this.drawing && document.pointerLockElement !== canvas)
      void Promise.resolve(canvas.requestPointerLock?.()).catch(() => {});
  };
  private readonly onMouseMove = (event: MouseEvent): void => {
    if (!this.drawing || document.pointerLockElement !== this.canvas()) return;
    this.turn(
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

  /** Entering faces the player's current heading; leaving releases every view
   * resource. Look listeners exist only while first person is active. */
  setActive(value: boolean, heading = NORTH_YAW): void {
    if (value === this.active || (value && this.disposed)) return;
    this.active = value;
    const canvas = this.canvas();
    if (value) {
      this.look.yaw = heading;
      this.look.pitch = 0;
      canvas.addEventListener("click", this.onClick);
      document.addEventListener("mousemove", this.onMouseMove);
      return;
    }
    canvas.removeEventListener("click", this.onClick);
    document.removeEventListener("mousemove", this.onMouseMove);
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    this.releaseView();
    this.failed = false;
  }

  /** True when the latest play frame was drawn in first person. */
  get drawing(): boolean {
    return this.active && this.drawn;
  }

  /** Called by the play view after drawing a frame in first person. */
  markDrawn(): void {
    this.drawn = true;
  }

  turn(yaw: number, pitch: number): void {
    this.look.yaw += yaw;
    this.look.pitch = clampPitch(this.look.pitch + pitch);
    this.lastManualLook = performance.now();
  }

  /** Per tick: right-stick look, then a driving camera eases back behind the vehicle. */
  update(dt: number, vehicleHeading?: number): void {
    if (!this.drawing) return;
    const stick = controllerInput.rightStick;
    if (stick.dx || stick.dy)
      this.turn(stick.dx * STICK_YAW_RATE * dt, -stick.dy * STICK_PITCH_RATE * dt);
    if (
      vehicleHeading !== undefined &&
      performance.now() - this.lastManualLook > VEHICLE_FOLLOW_DELAY_MS
    )
      this.look.yaw += angleDelta(vehicleHeading, this.look.yaw) * (1 - Math.exp(-3 * dt));
  }

  /** Screen-style manual input rotated into world axes for the current heading. */
  movement<T extends { dx: number; dy: number }>(input: T): T {
    if (!this.drawing) return input;
    return { ...input, ...cameraRelativeMovement(input.dx, input.dy, this.look.yaw) };
  }

  /** Horizontal look direction, for actions that aim where the player is looking. */
  forward(): { x: number; y: number } {
    const dir = lookDirection(this.look.yaw, 0);
    return { x: dir.x, y: dir.y };
  }

  /** The loaded view, or undefined while it loads or after its module failed to load. */
  currentView(): FirstPersonView | undefined {
    if (!this.active || this.disposed || this.failed) return undefined;
    if (this.view) return this.view;
    if (!this.loading) {
      this.loading = true;
      import("../rendering/firstperson/FirstPersonView.js")
        .then(({ FirstPersonView }) => {
          if (this.active && !this.disposed && !this.view)
            this.view = new FirstPersonView(this.sheets());
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

  /** Diagnostic counters from the loaded view, for captures and the 229 record. */
  get viewStats(): FirstPersonView["stats"] | undefined {
    return this.view ? { ...this.view.stats } : undefined;
  }

  /** The fixed view draws instead (editor, loading, failed to load, graphics
   * lost): give back ordinary controls and the pointer. */
  hideView(): void {
    this.drawn = false;
    if (document.pointerLockElement === this.canvas()) document.exitPointerLock();
  }

  private releaseView(): void {
    this.drawn = false;
    this.view?.dispose();
    this.view = null;
    this.frame.clear();
  }

  dispose(): void {
    if (this.disposed) return;
    this.setActive(false);
    this.disposed = true;
    this.releaseView();
  }
}

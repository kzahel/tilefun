import type { Entity } from "../entities/Entity.js";
import { Camera } from "../rendering/Camera.js";
import { beginPlayerPresentation, followPlayer } from "../rendering/PlayerPresentation.js";
import type { SurfaceFades } from "../rendering/SceneFrame.js";
import type { RenderRegion } from "../rendering/ViewLayout.js";
import type { DeviceSession } from "./DeviceSession.js";

/** How a view frames its device's world (226): follow one seat, frame a group
 * (later), or a fixed camera for labs. */
export interface CameraPolicy {
  /** Placed before the step's input (a fixed frame) rather than after the seat's
   * predicted step (following). */
  readonly beforeInput: boolean;
  /** Fixed-step update: move the camera's target. */
  tick(camera: Camera, session: DeviceSession): void;
  /** Display frame: place the interpolated camera until `restoreActual()`. */
  present(camera: Camera, session: DeviceSession, alpha: number): void;
}

/** Follow seat 0's predicted body, the game's camera. */
export function followSeat(
  options: { verticalFollow?: () => boolean; offsetY?: number } = {},
): CameraPolicy {
  const vertical = () => options.verticalFollow?.() ?? false;
  const offsetY = options.offsetY ?? 0;
  return {
    beforeInput: false,
    tick(camera, session) {
      const { replica, prediction } = session;
      followPlayer(camera, replica.playerEntity, vertical(), offsetY, prediction);
    },
    present(camera, { replica }, alpha) {
      beginPlayerPresentation(
        camera,
        replica.presentedPlayerEntity,
        alpha,
        undefined,
        vertical(),
        offsetY,
        replica.cameraPresentation,
      );
    },
  };
}

/** A fixed diagnostic camera: a point, or a framing that follows the presented
 * player through the same interpolation as everything else. */
export function fixedCamera(
  at: { wx: number; wy: number } | ((player: Entity, alpha: number) => { wx: number; wy: number }),
): CameraPolicy {
  const place = (camera: Camera, player: Entity, alpha: number) => {
    const point = typeof at === "function" ? at(player, alpha) : at;
    camera.x = point.wx;
    camera.y = point.wy;
  };
  return {
    beforeInput: true,
    tick(camera, { replica }) {
      place(camera, replica.playerEntity, 1);
    },
    present(camera, { replica }, alpha) {
      camera.applyInterpolation(alpha);
      place(camera, replica.presentedPlayerEntity, alpha);
    },
  };
}

/**
 * One screen region of a device session (226): its camera and camera policy,
 * its region of the render host's canvas and observer-local presentation (slab
 * fades). HUD and prompts stay with the page until split screen (slice 5).
 */
export class View {
  region: RenderRegion = { x: 0, y: 0, width: 1, height: 1 };
  /** Observer-local slab fades (see presentSurfaceScene). */
  readonly fades: SurfaceFades = new Map();

  constructor(
    public policy: CameraPolicy,
    readonly camera = new Camera(),
  ) {}

  /** Place the view; its camera's viewport is the region's size. */
  setRegion(region: RenderRegion): void {
    this.region = region;
    this.camera.setViewport(region.width, region.height);
  }
}

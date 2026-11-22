import { PIXEL_SCALE } from "../config/constants.js";
import type { Entity } from "../entities/Entity.js";
import { SHARED_SCREEN_SPAN } from "../physics/SharedScreenLeash.js";
import type { Camera } from "../rendering/Camera.js";
import { interpolatePosition, interpolateWz } from "../rendering/EntityInterpolation.js";
import { isVehicle } from "../traffic/Vehicle.js";
import type { DeviceSession } from "./DeviceSession.js";
import { presentedSeatBody, seatBody } from "./SeatFocus.js";
import type { CameraPolicy } from "./View.js";

const GUTTER = 20;
const MIN_ZOOM = 0.05;
const ELEVATION_ROOM = 96;

export function sharedHudTop(height: number): number {
  return height - Math.min(96, Math.max(40, height / 4));
}

interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function displayedBounds(body: Entity, alpha: number): Bounds {
  const { wx, wy } = interpolatePosition(body.position, body.prevPosition, alpha);
  const y = wy - (interpolateWz(body, alpha) ?? 0);
  const shape = body.collider;
  // A chassis can turn in any direction, so use its footprint's half diagonal.
  const radius = isVehicle(body) && shape ? Math.hypot(shape.width, shape.height) / 2 : 0;
  const width = Math.max(radius, (body.sprite?.spriteWidth ?? 32) / 2);
  const height = Math.max(radius + (shape?.physicalHeight ?? 0), body.sprite?.spriteHeight ?? 32);
  return { left: wx - width, right: wx + width, top: y - height, bottom: y + radius };
}

/** Frame the same interpolated party poses used to draw the actors. */
export function frameParty(fallback: CameraPolicy): CameraPolicy {
  let preferredZoom = 1;
  return {
    beforeInput: false,
    ...(fallback.eye && { eye: fallback.eye }),
    ...(fallback.focus && { focus: fallback.focus }),
    tick(camera, session) {
      preferredZoom = camera.zoom;
      if (!frame(camera, session, 1, seatBody, preferredZoom)) fallback.tick(camera, session);
    },
    present(camera, session, alpha) {
      camera.applyInterpolation(alpha);
      frame(camera, session, alpha, presentedSeatBody, preferredZoom);
      camera.x += camera.shakeOffsetX;
      camera.y += camera.shakeOffsetY;
    },
  };
}

function frame(
  camera: Camera,
  session: DeviceSession,
  alpha: number,
  seatBodyAt: (session: DeviceSession, seat: number) => Entity | undefined,
  preferredZoom: number,
): boolean {
  const bounds: Bounds[] = [];
  for (const { seat } of session.seats.list()) {
    const body =
      seatBodyAt(session, seat) ??
      (seat === 0
        ? (session.replica.presentedPlayerEntity ?? session.replica.playerEntity)
        : undefined);
    if (body && body.id !== -1) bounds.push(displayedBounds(body, alpha));
  }
  const primary = bounds[0];
  if (!primary) return false;

  const left = Math.min(...bounds.map((b) => b.left));
  const right = Math.max(...bounds.map((b) => b.right));
  const top = Math.min(...bounds.map((b) => b.top));
  const bottom = Math.max(...bounds.map((b) => b.bottom));
  const width = Math.max(1, camera.viewportWidth);
  const height = Math.max(1, sharedHudTop(camera.viewportHeight) - 32);
  const fitZoom = (spanX: number, spanY: number) =>
    Math.min(width / (spanX + 2 * GUTTER), height / (spanY + 2 * GUTTER)) / PIXEL_SCALE;
  const floor = Math.max(
    MIN_ZOOM,
    fitZoom(
      SHARED_SCREEN_SPAN.x + Math.max(...bounds.map((b) => b.right - b.left)),
      SHARED_SCREEN_SPAN.y + Math.max(...bounds.map((b) => b.bottom - b.top)) + ELEVATION_ROOM,
    ),
  );
  camera.zoom = Math.max(
    MIN_ZOOM,
    Math.min(preferredZoom, Math.max(floor, fitZoom(right - left, bottom - top))),
  );
  const scale = camera.scale;
  camera.x = keepInView((left + right) / 2, primary.left, primary.right, width / scale);
  camera.y =
    keepInView((top + bottom) / 2, primary.top, primary.bottom, height / scale) +
    (camera.viewportHeight - height) / (2 * scale);
  return true;
}

/** If the party starts far outside the limit, keep the primary player visible.
 * The ordinary off-screen markers still point to distant guests. */
function keepInView(target: number, min: number, max: number, span: number): number {
  const centre = (min + max) / 2;
  const room = Math.max(0, (span - (max - min)) / 2 - GUTTER);
  return Math.min(centre + room, Math.max(centre - room, target));
}

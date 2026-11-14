import type { Entity } from "../entities/Entity.js";
import { interpolatePosition, interpolateWz } from "../rendering/EntityInterpolation.js";
import {
  chaseEye,
  type FirstPersonEye,
  type FirstPersonLook,
} from "../rendering/firstperson/FirstPersonCamera.js";
import { occupiedVehicle } from "../traffic/VehicleSeats.js";

const EYE_FRACTION = 0.85;
const CHASE_DISTANCE = 96;
const CHASE_HEIGHT = 28;

/** A view's 3D eye (249): position and look in game axes, world pixels. */
export interface ViewEye extends FirstPersonEye {
  /** The viewer's own body, hidden from its own eye on foot. A driver's is drawn:
   * the chase camera sits behind the vehicle. */
  readonly own: number | undefined;
}

/** Displayed feet position and height, via the same interpolation as the scene collector. */
function displayed(e: Entity, alpha: number): { x: number; y: number; z: number } {
  const p = interpolatePosition(e.position, e.prevPosition, alpha);
  return { x: p.wx, y: p.wy, z: interpolateWz(e, alpha) ?? 0 };
}

/**
 * The eye a seat's player sees from: its own eyes on foot, or a chase camera
 * behind and above the vehicle it rides. `body` is the seat's own entity as
 * presented this display frame.
 */
export function seatEye(
  body: Entity,
  entities: readonly Entity[],
  look: FirstPersonLook,
  alpha: number,
): ViewEye {
  const vehicle = occupiedVehicle(body, entities);
  if (vehicle) {
    const target = displayed(vehicle, alpha);
    target.z += (vehicle.collider?.physicalHeight ?? 24) * 0.6;
    return { ...chaseEye(target, look, CHASE_DISTANCE, CHASE_HEIGHT), own: undefined };
  }
  const feet = displayed(body, alpha);
  const height = body.collider?.physicalHeight ?? 24;
  return { ...feet, z: feet.z + height * EYE_FRACTION, ...look, own: body.id };
}

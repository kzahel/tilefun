import type { Entity } from "../entities/Entity.js";
import { angleDelta, towProfile } from "./Towing.js";
import { vehicleBodySize, vehicleNoseHeading } from "./Vehicle.js";

/** Measured world-pixel registration of the retained transporter v2 (truck-local:
 * +x is the nose). The deck spans rear..front at height; the deployed ramp's two
 * tracks reach the ground at toe, leaving the central gap open for pedestrians. */
export const TRANSPORTER = {
  model: "car-transporter",
  type: "vehicle-v1:car-transporter",
  rear: -76,
  front: 34,
  halfWidth: 24,
  height: 24.65,
  toe: -152,
  loadX: -21,
  track: { y: 16, halfWidth: 6.5 },
} as const;
export const isTransporter = (e: { type?: string }) => e.type === TRANSPORTER.type;

/** A qualified passenger car standing wholly on the deck, aligned and unoccupied. */
export function transporterLoadCandidate(
  truck: Entity,
  entities: readonly Entity[],
): Entity | undefined {
  const heading = vehicleNoseHeading(truck),
    c = Math.cos(heading),
    s = Math.sin(heading);
  return entities.find((car) => {
    if (
      car.id === truck.id ||
      !towProfile(car) ||
      car.vehicleLink ||
      entities.some((other) => other.parentId === car.id) ||
      Math.hypot(car.velocity?.vx ?? 0, car.velocity?.vy ?? 0) > 3 ||
      Math.abs(angleDelta(vehicleNoseHeading(car), heading)) > Math.PI / 12 ||
      Math.abs((car.wz ?? 0) - (truck.wz ?? 0) - TRANSPORTER.height) > 8
    )
      return false;
    const dx = car.position.wx - truck.position.wx,
      dy = car.position.wy - truck.position.wy,
      x = dx * c + dy * s,
      y = -dx * s + dy * c,
      half = vehicleBodySize(car.type, 0).width / 2;
    return (
      x - half >= TRANSPORTER.rear - 4 &&
      x + half <= TRANSPORTER.front + 4 &&
      Math.abs(y) <= TRANSPORTER.halfWidth
    );
  });
}

/** Boarding reach: a car on a transporter deck is entered from the ground beside it. */
export function boardingHeightLimit(car: Entity, entities: readonly Entity[]): number {
  const deck = entities.some(
    (t) =>
      isTransporter(t) &&
      Math.abs((car.wz ?? 0) - (t.wz ?? 0) - TRANSPORTER.height) <= 8 &&
      Math.hypot(car.position.wx - t.position.wx, car.position.wy - t.position.wy) <= 80,
  );
  return deck ? 32 : 12;
}

/** Presentation grouping: an unparented body over the deck (or the deployed ramp). */
export function onTransporter(
  truck: Pick<Entity, "position" | "wz" | "vehicleHeading" | "sprite" | "vehicleRamp">,
  actor: Pick<Entity, "position" | "wz">,
): boolean {
  const heading = vehicleNoseHeading(truck),
    dx = actor.position.wx - truck.position.wx,
    dy = actor.position.wy - truck.position.wy;
  const x = dx * Math.cos(heading) + dy * Math.sin(heading),
    y = -dx * Math.sin(heading) + dy * Math.cos(heading),
    z = (actor.wz ?? 0) - (truck.wz ?? 0);
  if (Math.abs(y) > TRANSPORTER.halfWidth + 2 || z > 90 || x > TRANSPORTER.front + 2) return false;
  if (x >= TRANSPORTER.rear) return z >= 12;
  return truck.vehicleRamp === 1 && x >= TRANSPORTER.toe && z >= 1;
}

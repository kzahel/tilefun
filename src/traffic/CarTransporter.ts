import type { Entity } from "../entities/Entity.js";
import type { EntitySurface } from "../physics/surfaceHeight.js";
import { towProfile } from "./Towing.js";
import { applyVehicleFacing, vehicleBodySize, vehicleNoseHeading } from "./Vehicle.js";

/** Measured world-pixel registration of the retained transporter v2. */
export const TRANSPORTER = {
  model: "car-transporter",
  type: "vehicle-v1:car-transporter",
  rear: -76,
  front: 34,
  halfWidth: 24,
  height: 24.65,
  toe: -152,
  loadX: -21,
} as const;
export type TransporterAction = "deploy" | "stow" | "secure" | "release";
export function isTransporter(e: Pick<Entity, "type">) {
  return e.type === TRANSPORTER.type;
}
export function transporterLocal(truck: EntitySurface, position: Entity["position"]) {
  const h = vehicleNoseHeading(truck),
    c = Math.cos(h),
    s = Math.sin(h);
  const x = position.wx - truck.position.wx,
    y = position.wy - truck.position.wy;
  return { x: x * c + y * s, y: -x * s + y * c };
}
export function transporterWorld(truck: EntitySurface, x: number, y = 0) {
  const h = vehicleNoseHeading(truck),
    c = Math.cos(h),
    s = Math.sin(h);
  return { wx: truck.position.wx + x * c - y * s, wy: truck.position.wy + x * s + y * c };
}
export function transportable(car: Entity) {
  if (!towProfile(car) || car.towedBy !== undefined || car.towTargetId !== undefined) return false;
  const size = vehicleBodySize(car.type, 0);
  return size.width <= 100 && size.height <= 42;
}
function surfaceHeight(x: number, ramp: boolean): number | undefined {
  if (x > TRANSPORTER.front || (!ramp && x < TRANSPORTER.rear)) return;
  if (x >= TRANSPORTER.rear) return TRANSPORTER.height;
  if (x <= TRANSPORTER.toe) return 0;
  return (TRANSPORTER.height * (x - TRANSPORTER.toe)) / (TRANSPORTER.rear - TRANSPORTER.toe);
}
/** Two real axle contacts, with ground contact retained across the ramp toe.
 * Keep the conservative upright collision envelope; pitch is presentation only.
 * A full-body side/forward fit prevents entering through the cab or deck sides.
 */
export function transporterSupport(car: Entity, truck: Entity) {
  if (!isTransporter(truck) || !transportable(car) || car.id === truck.id) return;
  const p = towProfile(car);
  if (!p) return;
  const at = transporterLocal(truck, car.position),
    relative = vehicleNoseHeading(car) - vehicleNoseHeading(truck),
    c = Math.cos(relative),
    s = Math.sin(relative);
  if (c < Math.cos(Math.PI / 12)) return;
  const size = vehicleBodySize(car.type, relative);
  if (
    Math.abs(at.y) + size.height / 2 > TRANSPORTER.halfWidth - 1 ||
    at.x + size.width / 2 > TRANSPORTER.front - 2
  )
    return;
  const front = at.x + p.front * c,
    rear = at.x + p.rear * c;
  if (
    (front < TRANSPORTER.toe && at.x + size.width / 2 < TRANSPORTER.toe - 1) ||
    rear > TRANSPORTER.front
  )
    return;
  const ramp = truck.vehicleRamp === 1;
  const fz = surfaceHeight(front, ramp),
    rz = surfaceHeight(rear, ramp);
  if (fz === undefined || rz === undefined) return;
  if (!ramp && rear < TRANSPORTER.rear + 1) return;
  const pitch = Math.atan2(fz - rz, p.front - p.rear);
  const z = rz + ((fz - rz) * -p.rear) / (p.front - p.rear);
  return { truck, z: (truck.wz ?? 0) + z, pitch, x: at.x, y: at.y, side: s };
}
export function supportingTransporter(car: Entity, entities: readonly Entity[]) {
  for (const truck of entities) {
    const support = transporterSupport(car, truck);
    if (support && Math.abs((car.wz ?? 0) - support.z) < 2) return support;
  }
}
export function transportCandidate(truck: Entity, entities: readonly Entity[]) {
  return entities
    .filter((car) => {
      if (
        car.transportedBy !== undefined ||
        Math.hypot(car.velocity?.vx ?? 0, car.velocity?.vy ?? 0) > 0.5
      )
        return false;
      const s = transporterSupport(car, truck);
      if (!s) return false;
      const size = vehicleBodySize(car.type, 0);
      return (
        s &&
        Math.abs(s.z - (car.wz ?? 0)) < 1 &&
        s.x - size.width / 2 >= TRANSPORTER.rear + 2 &&
        s.x + size.width / 2 <= TRANSPORTER.front - 2 &&
        Math.abs(s.y) <= 3 &&
        Math.abs(s.pitch) < 0.001 &&
        Math.abs(s.side) < 0.07
      );
    })
    .sort((a, b) => a.id - b.id)[0];
}
export function transportedPose(car: Entity, truck: Entity): Entity {
  const next: Entity = {
    ...car,
    sprite: car.sprite && { ...car.sprite },
    position: transporterWorld(truck, TRANSPORTER.loadX),
    vehicleHeading: vehicleNoseHeading(truck),
    wz: (truck.wz ?? 0) + TRANSPORTER.height,
    groundZ: (truck.wz ?? 0) + TRANSPORTER.height,
    velocity: { vx: 0, vy: 0 },
    transportedBy: truck.id,
  };
  applyVehicleFacing(next, truck.sprite?.direction);
  if (next.sprite) next.sprite.moving = false;
  return next;
}

export function transporterRampBounds(truck: Entity) {
  const corners = [
    transporterWorld(truck, TRANSPORTER.toe, -TRANSPORTER.halfWidth),
    transporterWorld(truck, TRANSPORTER.toe, TRANSPORTER.halfWidth),
    transporterWorld(truck, TRANSPORTER.rear, -TRANSPORTER.halfWidth),
    transporterWorld(truck, TRANSPORTER.rear, TRANSPORTER.halfWidth),
  ];
  return {
    left: Math.min(...corners.map((p) => p.wx)),
    right: Math.max(...corners.map((p) => p.wx)),
    top: Math.min(...corners.map((p) => p.wy)),
    bottom: Math.max(...corners.map((p) => p.wy)),
  };
}

export function hasUnsecuredTransportLoad(truck: Entity, entities: readonly Entity[]) {
  return entities.some((e) => {
    if (e.transportedBy === truck.id) return false;
    const support = transporterSupport(e, truck);
    return support && Math.abs((e.wz ?? 0) - support.z) < 2;
  });
}

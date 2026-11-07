import type { Entity } from "../entities/Entity.js";
import profiles from "./towing-profiles.json" with { type: "json" };
import { vehicleNoseHeading } from "./Vehicle.js";

/** Wheel-lift towing in the shared world: the tow truck's cradle holds a qualified
 * car's front axle through one Rapier spherical joint; the car rolls on its rear
 * axle. Truck-local world pixels: the cradle sits behind the rear bumper. */
export const TOW = { hitch: -80, lift: 12, maxAngle: (70 * Math.PI) / 180, reach: 24 } as const;
export const TOW_TRUCK = "vehicle-v1:tow-truck";
export const isTowTruck = (e: { type?: string }) => e.type === TOW_TRUCK;
export type TowProfile = (typeof profiles)[keyof typeof profiles];
export const towProfile = (e: { type?: string }): TowProfile | undefined =>
  profiles[(e.type ?? "").slice(11) as keyof typeof profiles];

export const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/** Joint anchors in vehicle-local game axes (x nose, y lateral, z up from the datum). */
export function towAnchors(car: { type?: string }) {
  const p = towProfile(car);
  if (!p) throw Error("Unqualified tow car");
  const axle = p.frontZ * p.heightScale;
  return {
    truck: { x: TOW.hitch, y: 0, z: TOW.lift + axle },
    car: { x: p.front, y: 0, z: axle },
  };
}

function localPoint(e: Pick<Entity, "position" | "vehicleHeading" | "sprite">, x: number) {
  const heading = vehicleNoseHeading(e);
  return { wx: e.position.wx + x * Math.cos(heading), wy: e.position.wy + x * Math.sin(heading) };
}
export const towHitch = (truck: Entity) => localPoint(truck, TOW.hitch);

/** The nearest stopped, unoccupied, uncoupled qualified car whose front axle is at
 * the cradle and which faces the truck's direction. */
export function towCandidate(truck: Entity, entities: readonly Entity[]): Entity | undefined {
  const hitch = towHitch(truck),
    heading = vehicleNoseHeading(truck);
  const distance = (car: Entity) => {
    const front = localPoint(car, towProfile(car)?.front ?? 0);
    return Math.hypot(front.wx - hitch.wx, front.wy - hitch.wy);
  };
  return entities
    .filter(
      (car) =>
        car.id !== truck.id &&
        !!towProfile(car) &&
        car.towedBy === undefined &&
        car.towTargetId === undefined &&
        car.transportedBy === undefined &&
        !entities.some((other) => other.parentId === car.id) &&
        Math.hypot(car.velocity?.vx ?? 0, car.velocity?.vy ?? 0) <= 3 &&
        Math.abs((car.wz ?? 0) - (truck.wz ?? 0)) <= 6 &&
        Math.abs(angleDelta(vehicleNoseHeading(car), heading)) < Math.PI / 7 &&
        distance(car) <= TOW.reach,
    )
    .sort((a, b) => distance(a) - distance(b) || a.id - b.id)[0];
}

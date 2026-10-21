import type { Entity } from "../entities/Entity.js";
import profiles from "./towing-profiles.json" with { type: "json" };
import { applyVehicleFacing, vehicleNoseHeading } from "./Vehicle.js";

export type TowAction = "attach" | "release";
export const TOW_TRUCK = "vehicle-v1:tow-truck";
/** World pixels; cradle axle is behind the truck's existing rear bumper. */
export const TOW = { hitch: -80, lift: 12, maxAngle: (70 * Math.PI) / 180, reach: 24 } as const;
export const isTowTruck = (e: Pick<Entity, "type">) => e.type === TOW_TRUCK;
export const towProfile = (e: Pick<Entity, "type">) =>
  profiles[e.type.slice(11) as keyof typeof profiles];
/** Pin the displayed front axle to the displayed hitch after independent timelines
 * have been sampled. This corrects presentation only, never simulation state. */
export function presentedTowPosition(
  car: Entity,
  truck: Entity,
  truckPosition: Entity["position"],
) {
  const p = towProfile(car);
  if (!p) return car.position;
  const heading = vehicleNoseHeading(car),
    truckHeading = vehicleNoseHeading(truck);
  const x = towFrontOffset(car);
  return {
    wx: truckPosition.wx + TOW.hitch * Math.cos(truckHeading) - x * Math.cos(heading),
    wy: truckPosition.wy + TOW.hitch * Math.sin(truckHeading) - x * Math.sin(heading),
  };
}
export const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const pitches = new Map<string, number>();
export function towPitch(e: Pick<Entity, "type" | "towedBy">) {
  const p = towProfile(e);
  if (!p || e.towedBy === undefined) return 0;
  let pitch = pitches.get(e.type);
  if (pitch === undefined) {
    let low = 0,
      high = Math.PI / 3;
    for (let i = 0; i < 32; i++) {
      const a = (low + high) / 2,
        c = Math.cos(a),
        s = Math.sin(a);
      const clearance =
        (p.front - p.rear) * s +
        (p.frontZ - p.rearZ) * p.heightScale * c -
        Math.hypot(p.radius * s, p.radius * p.heightScale * c) +
        Math.hypot(p.rearRadius * s, p.rearRadius * p.heightScale * c);
      if (clearance < TOW.lift) low = a;
      else high = a;
    }
    pitch = (low + high) / 2;
    pitches.set(e.type, pitch);
  }
  return pitch;
}
export function towFrontOffset(e: Pick<Entity, "type" | "towedBy">) {
  const p = towProfile(e);
  if (!p) return 0;
  const pitch = towPitch(e);
  return (
    p.rear +
    (p.front - p.rear) * Math.cos(pitch) +
    (p.rearZ - p.frontZ) * p.heightScale * Math.sin(pitch)
  );
}
/** Rotate about the rear tire's ground contact. Ground/body origin stays stable. */
export function towMeshOffset(e: Pick<Entity, "type" | "towedBy">) {
  const p = towProfile(e),
    pitch = towPitch(e);
  if (!p || !pitch) return { x: 0, z: 0 };
  const c = Math.cos(pitch),
    s = Math.sin(pitch),
    r = p.rearZ * p.heightScale;
  // The fitted tire is an ellipse in X/Z. Its lowest point still touches ground
  // after pitching, while the same-size front tire clears it by exactly lift.
  return {
    x: p.rear * (1 - c) + r * s,
    z: -p.rear * s + Math.hypot(p.rearRadius * s, p.rearRadius * p.heightScale * c) - r * c,
  };
}
export function towHitch(truck: Entity) {
  const heading = vehicleNoseHeading(truck);
  return {
    wx: truck.position.wx + TOW.hitch * Math.cos(heading),
    wy: truck.position.wy + TOW.hitch * Math.sin(heading),
  };
}
export function towAxle(car: Entity, axle: "front" | "rear") {
  const p = towProfile(car);
  if (!p) throw Error("Unqualified tow car");
  const heading = vehicleNoseHeading(car);
  const x = axle === "rear" ? p.rear : towFrontOffset(car);
  return {
    wx: car.position.wx + x * Math.cos(heading),
    wy: car.position.wy + x * Math.sin(heading),
  };
}
export function towCandidate(truck: Entity, entities: readonly Entity[]) {
  const hitch = towHitch(truck),
    heading = vehicleNoseHeading(truck);
  return entities
    .filter((car) => {
      if (
        !towProfile(car) ||
        car.transportedBy !== undefined ||
        car.transportLoadId !== undefined ||
        car.towedBy !== undefined ||
        car.towTargetId !== undefined ||
        Math.hypot(car.velocity?.vx ?? 0, car.velocity?.vy ?? 0) > 0.5 ||
        Math.abs((car.wz ?? 0) - (truck.wz ?? 0)) > 0.1
      )
        return false;
      const front = towAxle(car, "front");
      return (
        Math.abs(angleDelta(vehicleNoseHeading(car), heading)) < Math.PI / 7 &&
        Math.hypot(front.wx - hitch.wx, front.wy - hitch.wy) <= TOW.reach
      );
    })
    .sort((a, b) => {
      const pa = towAxle(a, "front"),
        pb = towAxle(b, "front");
      return (
        Math.hypot(pa.wx - hitch.wx, pa.wy - hitch.wy) -
          Math.hypot(pb.wx - hitch.wx, pb.wy - hitch.wy) || a.id - b.id
      );
    })[0];
}
/** Kinematic rear axle follows its previous ground contact; no sideways trailer drag. */
export function towedPose(before: Entity, truck: Entity, attach = false): Entity | undefined {
  const p = towProfile(before);
  if (!p) return;
  const hitch = towHitch(truck),
    rear = towAxle(before, "rear");
  const heading = attach
    ? vehicleNoseHeading(truck)
    : Math.atan2(hitch.wy - rear.wy, hitch.wx - rear.wx);
  if (Math.abs(angleDelta(heading, vehicleNoseHeading(truck))) > TOW.maxAngle) return;
  const next: Entity = {
    ...before,
    sprite: before.sprite && { ...before.sprite },
    towedBy: truck.id,
    vehicleHeading: Math.fround(heading),
  };
  const x = towFrontOffset(next);
  next.position = {
    wx: hitch.wx - x * Math.cos(vehicleNoseHeading(next)),
    wy: hitch.wy - x * Math.sin(vehicleNoseHeading(next)),
  };
  next.velocity = { ...(truck.velocity ?? { vx: 0, vy: 0 }) };
  applyVehicleFacing(
    next,
    Math.abs(Math.cos(heading)) >= Math.abs(Math.sin(heading))
      ? Math.cos(heading) > 0
        ? 3
        : 2
      : Math.sin(heading) > 0
        ? 0
        : 1,
  );
  return next;
}

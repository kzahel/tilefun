import type { Entity } from "../entities/Entity.js";
import { vehicleNoseHeading } from "../traffic/Vehicle.js";
import type { EquipmentPose } from "./EquipmentPose.js";

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
export function isTransporter(e: Pick<Entity, "type">) {
  return e.type === TRANSPORTER.type;
}
export function transporterLocal(truck: EquipmentPose, position: Entity["position"]) {
  const h = vehicleNoseHeading(truck),
    c = Math.cos(h),
    s = Math.sin(h);
  const x = position.wx - truck.position.wx,
    y = position.wy - truck.position.wy;
  return { x: x * c + y * s, y: -x * s + y * c };
}
export function transporterWorld(truck: EquipmentPose, x: number, y = 0) {
  const h = vehicleNoseHeading(truck),
    c = Math.cos(h),
    s = Math.sin(h);
  return { wx: truck.position.wx + x * c - y * s, wy: truck.position.wy + x * s + y * c };
}

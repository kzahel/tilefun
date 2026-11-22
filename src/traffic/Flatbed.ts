import type { Entity } from "../entities/Entity.js";
import { multiplyRotations, rotateBodyVector, yawRotation } from "../physics/BodyRotation.js";
import { vehicleNoseHeading } from "./Vehicle.js";

export const isFlatbed = (e: Pick<Entity, "type">) => e.type === "vehicle-v1:flatbed-truck";
const SCALE = 400 / 23;
/** Loaded platform dimensions from the retained flatbed master. */
export const FLATBED = {
  back: -3.07 * SCALE,
  front: 0.85 * SCALE,
  halfWidth: 1.1 * SCALE,
  floor: 1.24 * SCALE,
};

export function onFlatbed(truck: Entity, cargo: Entity) {
  const [x, y, z, w] = truck.bodyRotation ?? yawRotation(vehicleNoseHeading(truck));
  const inverse = [-x, -y, -z, w] as const;
  const local = rotateBodyVector(
    inverse,
    cargo.position.wx - truck.position.wx,
    cargo.position.wy - truck.position.wy,
    (cargo.wz ?? 0) - (truck.wz ?? 0),
  );
  const shape = cargo.collider;
  if (!shape) return false;
  const orientation = multiplyRotations(inverse, cargo.bodyRotation ?? yawRotation(0));
  const xAxis = rotateBodyVector(orientation, shape.width / 2, 0, 0);
  const yAxis = rotateBodyVector(orientation, 0, shape.height / 2, 0);
  const up = rotateBodyVector(orientation, 0, 0, (shape.physicalHeight ?? 0) / 2);
  const bottom = local.z + up.z - Math.abs(xAxis.z) - Math.abs(yAxis.z) - Math.abs(up.z);
  return (
    local.x + up.x >= FLATBED.back &&
    local.x + up.x <= FLATBED.front &&
    Math.abs(local.y + up.y) <= FLATBED.halfWidth &&
    Math.abs(bottom - FLATBED.floor) < 1.5
  );
}

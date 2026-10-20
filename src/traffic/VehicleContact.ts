import { isBoat } from "../boats/Boat.js";
import { getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import { axisBox, boxMotion, type OrientedBox } from "../physics/OrientedBox.js";
import { isVehicle, vehicleBodySize, vehicleNoseHeading } from "./Vehicle.js";

export function orientedCar(entity: Entity): boolean {
  return isVehicle(entity) && !isBoat(entity);
}
export function entityBody(entity: Entity): OrientedBox {
  if (!entity.collider) throw Error("Contact body requires a collider");
  const low = entity.wz ?? 0,
    high = low + (entity.collider.physicalHeight ?? 16);
  if (!orientedCar(entity) || entity.vehicleHeading === undefined)
    return axisBox(getEntityAABB(entity.position, entity.collider), low, high);
  const size = vehicleBodySize(entity.type, 0);
  return {
    x: entity.position.wx,
    y: entity.position.wy,
    angle: vehicleNoseHeading(entity),
    halfLength: size.width / 2,
    halfWidth: size.height / 2,
    low,
    high,
  };
}
export function carBodyMotion(before: Entity, after: Entity) {
  return boxMotion(
    entityBody(before),
    entityBody(after),
    before.vehicleHeading !== undefined && after.vehicleHeading !== undefined,
  );
}

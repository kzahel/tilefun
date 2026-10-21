import { required } from "../art/ArtCatalog.js";
import { aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import { boardingDistance, checkedCarPose } from "../traffic/Driving.js";
import { roofSupport } from "../traffic/RoofSupport.js";
import { isTowTruck, type TowAction, towCandidate, towedPose } from "../traffic/Towing.js";
import { applyVehicleFacing } from "../traffic/Vehicle.js";
import type { PlayerSession } from "./PlayerSession.js";
import type { Realm } from "./Realm.js";

export function controlTow(realm: Realm, session: PlayerSession, id: number, action: TowAction) {
  const truck = realm.traffic?.states.get(id),
    player = session.player,
    driver = realm.vehicles.get(session);
  if (!truck || !isTowTruck(truck.entity) || !["attach", "release"].includes(action))
    throw Error("Tow truck unavailable.");
  const vehicle = truck.entity;
  if (
    session.editorEnabled ||
    session.transitioning ||
    session.retired ||
    session.debugPaused ||
    realm.saveManager?.pressured ||
    (player.parentId !== undefined && driver?.id !== id) ||
    boardingDistance(player, vehicle) > 32 ||
    player.jumpVZ !== undefined ||
    Math.abs((player.wz ?? 0) - (vehicle.wz ?? 0)) > 12
  )
    throw Error("Stand beside the tow truck or use its driver controls.");
  if (truck.driverId !== undefined && truck.driverId !== player.id)
    throw Error("The driver controls the tow lift.");
  if (Math.hypot(vehicle.velocity?.vx ?? 0, vehicle.velocity?.vy ?? 0) > 0.5)
    throw Error("Stop the tow truck first.");
  const entities = realm.entityManager.entities;
  if (action === "attach") {
    if (truck.towTargetIdentity) throw Error("Release the car before attaching another.");
    const car = towCandidate(vehicle, entities),
      target = car && realm.traffic?.states.get(car.id);
    if (!car || !target?.parked || target.shopping)
      throw Error("Back the lift up to the front wheels of a parked passenger car.");
    if (
      target.driverId !== undefined ||
      entities.some((e) => e.parentId === car.id || roofSupport(e, [car])?.id === car.id)
    )
      throw Error("Everyone must leave the car before towing.");
    const pose = towedPose(car, vehicle, true);
    if (
      !pose ||
      !checkedCarPose(
        car,
        pose,
        1 / 60,
        realm.world,
        realm.propManager.props,
        entities.filter((e) => e.id !== id),
      )
    )
      throw Error("There is no clear space to lift this car.");
    // Reject bodies within the conservative elevated envelope too.
    if (
      entities.some(
        (e) =>
          e.id !== id &&
          e.id !== car.id &&
          e.parentId !== id &&
          e.collider &&
          e.collider.solid !== false &&
          (e.wz ?? 0) < (pose.collider?.physicalHeight ?? 40) &&
          (e.wz ?? 0) + (e.collider.physicalHeight ?? 12) > 0 &&
          aabbsOverlap(
            getEntityAABB(e.position, e.collider),
            getEntityAABB(pose.position, required(pose.collider)),
          ),
      )
    )
      throw Error("Clear the space around the car first.");
    Object.assign(car, pose);
    car.prevPosition = { ...car.position };
    target.towTruckIdentity = required(vehicle.proceduralId);
    truck.towTargetIdentity = required(car.proceduralId);
    vehicle.towTargetId = car.id;
    truck.parked = target.parked = true;
    target.speed = truck.speed = 0;
    car.velocity = vehicle.velocity = { vx: 0, vy: 0 };
    realm.entityManager.spatialHash.update(car);
    realm.traffic?.onChange?.(target, false);
  } else {
    const target = realm.traffic?.states.get(vehicle.towTargetId ?? 0);
    if (!target || target.towTruckIdentity !== vehicle.proceduralId)
      throw Error("The towed car is not ready yet.");
    const car = target.entity,
      pose = { ...car, sprite: car.sprite && { ...car.sprite } };
    delete pose.towedBy;
    applyVehicleFacing(pose);
    if (
      !checkedCarPose(
        car,
        pose,
        1 / 60,
        realm.world,
        realm.propManager.props,
        entities.filter((e) => e.id !== id),
      )
    )
      throw Error("Find clear, level ground before releasing the car.");
    Object.assign(car, pose);
    delete car.towedBy;
    delete target.towTruckIdentity;
    delete vehicle.towTargetId;
    delete truck.towTargetIdentity;
    car.velocity = { vx: 0, vy: 0 };
    if (car.sprite) car.sprite.moving = false;
    realm.entityManager.spatialHash.update(car);
    realm.traffic?.onChange?.(target, false);
  }
  realm.traffic?.onChange?.(truck, false);
}

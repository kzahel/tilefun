import { required } from "../art/ArtCatalog.js";
import { aabbOverlapsPropWalls, aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import {
  hasUnsecuredTransportLoad,
  isTransporter,
  TRANSPORTER,
  type TransporterAction,
  transportCandidate,
  transportedPose,
  transporterLocal,
  transporterWorld,
} from "../traffic/CarTransporter.js";
import { boardingDistance, checkedCarPose } from "../traffic/Driving.js";
import { roofSupport } from "../traffic/RoofSupport.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import type { PlayerSession } from "./PlayerSession.js";
import type { Realm } from "./Realm.js";

export function controlTransporter(
  realm: Realm,
  session: PlayerSession,
  id: number,
  action: TransporterAction,
) {
  const state = realm.traffic?.states.get(id),
    player = session.player;
  if (
    !Number.isSafeInteger(id) ||
    !state ||
    !isTransporter(state.entity) ||
    !["deploy", "stow", "secure", "release"].includes(action)
  )
    throw Error("Car transporter unavailable.");
  const truck = state.entity,
    entities = realm.entityManager.entities;
  if (
    session.editorEnabled ||
    session.transitioning ||
    session.retired ||
    session.debugPaused ||
    realm.saveManager?.pressured ||
    (player.parentId !== undefined && player.parentId !== id) ||
    player.jumpVZ !== undefined ||
    boardingDistance(player, truck) > 32 ||
    Math.abs((player.wz ?? 0) - (truck.wz ?? 0)) > 12
  )
    throw Error("Stand beside the transporter or use its driver controls.");
  if (state.driverId !== undefined && state.driverId !== player.id)
    throw Error("The driver controls the transporter.");
  if (Math.hypot(truck.velocity?.vx ?? 0, truck.velocity?.vy ?? 0) > 0.5)
    throw Error("Stop the transporter first.");
  const occupied = (car: typeof truck) =>
    entities.some((e) => e.parentId === car.id || roofSupport(e, [car])?.id === car.id);
  if (action === "deploy") {
    // The deployment envelope includes the entire ramp swing. Level dry ground
    // and readiness are checked across it, not only at the truck's anchor.
    const corners = [
      transporterWorld(truck, TRANSPORTER.toe - 4, -26),
      transporterWorld(truck, TRANSPORTER.toe - 4, 26),
      transporterWorld(truck, TRANSPORTER.rear + 2, -26),
      transporterWorld(truck, TRANSPORTER.rear + 2, 26),
    ];
    const box = {
      left: Math.min(...corners.map((p) => p.wx)),
      right: Math.max(...corners.map((p) => p.wx)),
      top: Math.min(...corners.map((p) => p.wy)),
      bottom: Math.max(...corners.map((p) => p.wy)),
    };
    for (let y = Math.floor(box.top / 16); y <= Math.floor(box.bottom / 16); y++)
      for (let x = Math.floor(box.left / 16); x <= Math.floor(box.right / 16); x++)
        if (
          !realm.world.getChunkIfLoaded(Math.floor(x / 16), Math.floor(y / 16)) ||
          realm.world.getCollisionIfLoaded(x, y) & (CollisionFlag.Solid | CollisionFlag.Water) ||
          Math.abs(realm.world.getHeightAt(x, y) - (truck.wz ?? 0)) > 0.1
        )
          throw Error("Park on clear, level ground with space behind the truck.");
    if (
      realm.propManager.props.some((p) =>
        aabbOverlapsPropWalls(box, p.position, p, truck.wz ?? 0, 105),
      ) ||
      entities.some(
        (e) =>
          e.id !== truck.id &&
          e.id !== truck.transportLoadId &&
          e.collider &&
          e.collider.solid !== false &&
          (e.wz ?? 0) < (truck.wz ?? 0) + 105 &&
          (e.wz ?? 0) + (e.collider.physicalHeight ?? 16) > (truck.wz ?? 0) &&
          aabbsOverlap(box, getEntityAABB(e.position, e.collider)),
      )
    )
      throw Error("Clear the space behind the loading ramp first.");
    truck.vehicleRamp = 1;
  } else if (action === "stow") {
    if (hasUnsecuredTransportLoad(truck, entities))
      throw Error("Secure the car on the deck or drive it off before stowing the ramp.");
    delete truck.vehicleRamp;
  } else if (action === "secure") {
    if (truck.transportLoadId !== undefined || state.transportLoadIdentity)
      throw Error("Only one car fits on this transporter.");
    if (truck.vehicleRamp !== 1) throw Error("Deploy the loading ramp first.");
    const car = transportCandidate(truck, entities),
      target = car && realm.traffic?.states.get(car.id);
    if (
      !car ||
      !target?.parked ||
      target.shopping ||
      target.driverId !== undefined ||
      occupied(car)
    )
      throw Error("Park a passenger car centrally on the deck and get out before securing it.");
    const pose = transportedPose(car, truck);
    if (
      !checkedCarPose(
        car,
        pose,
        1 / 60,
        realm.world,
        realm.propManager.props,
        entities.filter((e) => e.id !== truck.id),
        undefined,
        false,
        pose.wz,
      )
    )
      throw Error("Clear the space around the loaded car first.");
    Object.assign(car, pose);
    car.prevPosition = { ...car.position };
    car.prevWz = car.wz ?? 0;
    truck.transportLoadId = car.id;
    state.transportLoadIdentity = required(car.proceduralId);
    target.transporterIdentity = required(truck.proceduralId);
    state.parked = target.parked = true;
    state.speed = target.speed = 0;
    realm.entityManager.spatialHash.update(car);
    realm.traffic?.onChange?.(target, false);
  } else {
    if (truck.vehicleRamp !== 1) throw Error("Deploy the ramp before releasing the car.");
    const target = realm.traffic?.states.get(truck.transportLoadId ?? 0);
    if (!target || target.transporterIdentity !== truck.proceduralId)
      throw Error("The loaded car is not ready yet.");
    const car = target.entity;
    if (occupied(car)) throw Error("Everyone must leave the loaded car first.");
    const at = transporterLocal(truck, car.position);
    if (Math.abs(at.x - TRANSPORTER.loadX) > 1) throw Error("The load must be on the deck.");
    delete car.transportedBy;
    delete target.transporterIdentity;
    delete truck.transportLoadId;
    delete state.transportLoadIdentity;
    car.velocity = { vx: 0, vy: 0 };
    realm.traffic?.onChange?.(target, false);
  }
  realm.traffic?.onChange?.(state, false);
}

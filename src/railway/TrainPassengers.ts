import { aabbOverlapsPropWalls, getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import type { PropManager } from "../entities/PropManager.js";
import { roofSupport } from "../traffic/RoofSupport.js";
import type { World } from "../world/World.js";
import { isCurveTrain } from "./CurveTrain.js";

/** Native poses snap by quarters. Keep a passenger's longitudinal/lateral roof
 * fractions through that snap, including the different native carriage lengths. */
export function trainPassengerPosition(rider: Entity, before: Entity, after: Entity) {
  const a = required(before.collider),
    b = required(after.collider);
  const quarter = (e: Entity) =>
    isCurveTrain(e) ? Math.floor(((e.sprite?.frameRow ?? 0) + 32) / 64) % 4 : 0;
  const qa = quarter(before),
    qb = quarter(after);
  if (qa === qb)
    return {
      wx: rider.position.wx + after.position.wx - before.position.wx,
      wy: rider.position.wy + after.position.wy - before.position.wy,
    };
  const x = (rider.position.wx - before.position.wx - a.offsetX) / (a.width / 2);
  const y = (rider.position.wy - before.position.wy - a.offsetY + a.height / 2) / (a.height / 2);
  const turn = (((qb - qa + 4) % 4) * Math.PI) / 2;
  return {
    wx: after.position.wx + b.offsetX + ((x * Math.cos(turn) - y * Math.sin(turn)) * b.width) / 2,
    wy:
      after.position.wy +
      b.offsetY -
      b.height / 2 +
      ((x * Math.sin(turn) + y * Math.cos(turn)) * b.height) / 2,
  };
}

/** Check passenger headroom too: a clear train body is insufficient under a bridge.
 * Authority carries by the actual committed pose, so braking never slides riders. */
export function planTrainPassengers(
  before: Entity,
  after: Entity,
  entities: EntityManager,
  props: PropManager,
  world: World,
): { rider: Entity; position: Entity["position"]; z: number }[] | undefined {
  const riders = entities.entities.filter(
    (e) => e.type === "player" && roofSupport(e, entities.entities)?.id === before.id,
  );
  const result = [];
  for (const rider of riders) {
    const position = trainPassengerPosition(rider, before, after);
    const z = (after.wz ?? 0) + (after.collider?.physicalHeight ?? 44);
    const current = getEntityAABB(rider.position, required(rider.collider));
    const next = getEntityAABB(position, required(rider.collider));
    const swept = {
      left: Math.min(current.left, next.left),
      right: Math.max(current.right, next.right),
      top: Math.min(current.top, next.top),
      bottom: Math.max(current.bottom, next.bottom),
    };
    for (let y = Math.floor(swept.top / 16); y <= Math.floor(swept.bottom / 16); y++)
      for (let x = Math.floor(swept.left / 16); x <= Math.floor(swept.right / 16); x++)
        if (!world.getChunkIfLoaded(Math.floor(x / 16), Math.floor(y / 16))) return;
    for (const prop of props.getPropsInChunkRange(
      Math.floor(swept.left / 256),
      Math.floor(swept.top / 256),
      Math.floor(swept.right / 256),
      Math.floor(swept.bottom / 256),
    ))
      if (
        aabbOverlapsPropWalls(
          swept,
          prop.position,
          prop,
          Math.min(rider.wz ?? z, z),
          (rider.collider?.physicalHeight ?? 16) + Math.abs((rider.wz ?? z) - z),
        )
      )
        return;
    result.push({ rider, position, z });
  }
  return result;
}

export function carryTrainPassengers(
  plan: NonNullable<ReturnType<typeof planTrainPassengers>>,
  entities: EntityManager,
) {
  for (const { rider, position, z } of plan) {
    rider.position = position;
    rider.wz = rider.groundZ = z;
    entities.spatialHash.update(rider);
  }
}

import { required } from "../art/ArtCatalog.js";

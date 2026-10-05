import { required } from "../art/ArtCatalog.js";
import { aabbOverlapsPropWalls, getEntityAABB } from "../entities/collision.js";
import { Direction, type Entity } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import type { PropManager } from "../entities/PropManager.js";
import { isCurveTrain } from "../railway/CurveTrain.js";
import type { World } from "../world/World.js";
import { roofSupport } from "./RoofSupport.js";
import { isVehicle } from "./Vehicle.js";

/** Coordinates in the native cardinal roof pose, normalized by its dimensions. */
export interface RoofOffset {
  x: number;
  y: number;
}
function quarter(e: Entity): number {
  if (isCurveTrain(e)) return Math.floor(((e.sprite?.frameRow ?? 0) + 32) / 64) % 4;
  if (isVehicle(e)) return [1, 3, 2, 0][e.sprite?.direction ?? Direction.Down] ?? 0;
  return 0;
}
export function roofOffset(position: Entity["position"], support: Entity): RoofOffset {
  const c = required(support.collider),
    angle = (-quarter(support) * Math.PI) / 2;
  const x = (position.wx - support.position.wx - c.offsetX) / (c.width / 2);
  const y = (position.wy - support.position.wy - c.offsetY + c.height / 2) / (c.height / 2);
  return {
    x: x * Math.cos(angle) - y * Math.sin(angle),
    y: x * Math.sin(angle) + y * Math.cos(angle),
  };
}
export function roofPosition(offset: RoofOffset, support: Entity): Entity["position"] {
  const c = required(support.collider),
    angle = (quarter(support) * Math.PI) / 2;
  return {
    wx:
      support.position.wx +
      c.offsetX +
      ((offset.x * Math.cos(angle) - offset.y * Math.sin(angle)) * c.width) / 2,
    wy:
      support.position.wy +
      c.offsetY -
      c.height / 2 +
      ((offset.x * Math.sin(angle) + offset.y * Math.cos(angle)) * c.height) / 2,
  };
}
export function movingPassengerPosition(rider: Entity, before: Entity, after: Entity) {
  return roofPosition(roofOffset(rider.position, before), after);
}

/** Check passenger headroom too: a clear train body is insufficient under a bridge.
 * Authority carries by the actual committed pose, so braking never slides riders. */
export function planMovingPassengers(
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
    const position = movingPassengerPosition(rider, before, after);
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

export function carryMovingPassengers(
  plan: NonNullable<ReturnType<typeof planMovingPassengers>>,
  entities: EntityManager,
) {
  for (const { rider, position, z } of plan) {
    rider.position = position;
    rider.wz = rider.groundZ = z;
    entities.spatialHash.update(rider);
  }
}

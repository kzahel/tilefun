import { aabbOverlapsPropWalls, getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import type { EntitySurface, PropSurface } from "../physics/surfaceHeight.js";
import {
  bedFloorSupport,
  bedHeading,
  bedTilt,
  hasVehicleBed,
  vehicleBedBlocks,
} from "./VehicleBed.js";

/** Bounded frictional downhill drift, shared by player authority/prediction and
 * loose cargo. Upright bodies remain independent; there is no seat attachment.
 * Airborne actors retain ordinary world momentum and gravity instead. */
export function slideOnVehicleBed(
  actor: Entity,
  dt: number,
  entities: readonly EntitySurface[],
  props: readonly PropSurface[] = [],
) {
  if (actor.parentId !== undefined || actor.jumpVZ !== undefined || !actor.collider) return;
  const box = getEntityAABB(actor.position, actor.collider);
  const truck = entities.find(
    (e) =>
      hasVehicleBed(e) &&
      bedTilt(e) > 0 &&
      Math.abs((actor.wz ?? 0) - (bedFloorSupport(e, box) ?? -Infinity)) < 0.1,
  );
  if (!truck) return;
  const a = bedTilt(truck),
    speed = 72 * Math.max(0, Math.sin(a) - 0.2 * Math.cos(a));
  if (speed === 0) return;
  const heading = bedHeading(truck),
    vx = -speed * Math.cos(a) * Math.cos(heading),
    vy = -speed * Math.cos(a) * Math.sin(heading);
  const position = { wx: actor.position.wx + vx * dt, wy: actor.position.wy + vy * dt };
  const next = getEntityAABB(position, actor.collider),
    floor = bedFloorSupport(truck, next);
  const z = floor ?? actor.wz ?? 0,
    height = actor.collider.physicalHeight ?? 12;
  if (
    vehicleBedBlocks(truck, next, z, height) ||
    props.some((p) => aabbOverlapsPropWalls(next, p.position, p, z, height))
  )
    return;
  actor.position = position;
  if (floor !== undefined) actor.wz = actor.groundZ = floor;
  else {
    actor.jumpVZ = -speed * Math.sin(a);
    actor.jumpZ = 0;
    actor.velocity ??= { vx: 0, vy: 0 };
    actor.velocity.vx += vx;
    actor.velocity.vy += vy;
    if (actor.type === "player") {
      actor.airMomentumX = vx;
      actor.airMomentumY = vy;
    }
  }
}

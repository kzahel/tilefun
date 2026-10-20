import { aabbOverlapsPropWalls, getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import type { PropManager } from "../entities/PropManager.js";
import type { World } from "../world/World.js";
import { carryMovingPassengers, planMovingPassengers } from "./MovingSupport.js";
import {
  bedPartMoves,
  bedPartVertices,
  bedTilt,
  DUMP_BED,
  hasVehicleBed,
  vehicleBedBlocks,
} from "./VehicleBed.js";

/** Fixed-clock articulation. Validate and commit equipment and loose supports together. */
export function tickVehicleBedEquipment(
  truck: Entity,
  dt: number,
  entities: EntityManager,
  props: PropManager,
  world: World,
) {
  if (!hasVehicleBed(truck)) return false;
  const angle = bedTilt(truck),
    target = truck.vehicleBedTarget ?? 0;
  if (Math.abs(target - angle) < 1e-6) return false;
  if (Math.hypot(truck.velocity?.vx ?? 0, truck.velocity?.vy ?? 0) > 0.5) return false;
  const tilt = Math.fround(
    Math.max(
      0,
      Math.min(
        DUMP_BED.maxTilt,
        angle + Math.sign(target - angle) * Math.min(Math.abs(target - angle), (dt * Math.PI) / 12),
      ),
    ),
  );
  const after = { ...truck, vehicleBedTilt: tilt };
  const plan = planMovingPassengers(truck, after, entities, props, world);
  if (!plan) return false;
  // A small angular step bounds the sweep; enclosing before/after prisms also
  // protects thin external slabs and unloaded boundaries, including the gate.
  for (const part of DUMP_BED.parts) {
    if (!bedPartMoves(part)) continue;
    const vertices = [...bedPartVertices(truck, part), ...bedPartVertices(after, part)];
    const box = {
      left: Math.min(...vertices.map((v) => v.x)) - 0.05,
      right: Math.max(...vertices.map((v) => v.x)) + 0.05,
      top: Math.min(...vertices.map((v) => v.y)) - 0.05,
      bottom: Math.max(...vertices.map((v) => v.y)) + 0.05,
    };
    const low = Math.min(...vertices.map((v) => v.z)) - 0.05,
      high = Math.max(...vertices.map((v) => v.z)) + 0.05;
    const range = {
      minCx: Math.floor(box.left / 256),
      maxCx: Math.floor(box.right / 256),
      minCy: Math.floor(box.top / 256),
      maxCy: Math.floor(box.bottom / 256),
    };
    for (let y = range.minCy; y <= range.maxCy; y++)
      for (let x = range.minCx; x <= range.maxCx; x++)
        if (!world.getChunkIfLoaded(x, y)) return false;
    if (
      props
        .getPropsInChunkRange(range.minCx, range.minCy, range.maxCx, range.maxCy)
        .some((p) => aabbOverlapsPropWalls(box, p.position, p, low, high - low))
    )
      return false;
  }
  const carried = new Set(plan.map((p) => p.rider.id));
  for (const actor of entities.entities) {
    if (
      actor.id === truck.id ||
      actor.parentId !== undefined ||
      !actor.collider ||
      actor.collider.solid === false ||
      carried.has(actor.id)
    )
      continue;
    const box = getEntityAABB(actor.position, actor.collider),
      height = actor.collider.physicalHeight ?? 12;
    if (
      vehicleBedBlocks(after, box, actor.wz ?? 0, height) &&
      !vehicleBedBlocks(truck, box, actor.wz ?? 0, height)
    )
      return false;
  }
  truck.vehicleBedTilt = tilt;
  if (tilt === 0 && target === 0) {
    delete truck.vehicleBedTilt;
    delete truck.vehicleBedTarget;
  }
  carryMovingPassengers(plan, entities);
  entities.spatialHash.update(truck);
  return true;
}

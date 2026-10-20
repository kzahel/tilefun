import type { Entity } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import type { PropManager } from "../entities/PropManager.js";
import { bedTilt, hasVehicleBed } from "../traffic/VehicleBed.js";
import { slideOnVehicleBed } from "../traffic/VehicleBedSlide.js";
import { isLooseCargo } from "../traffic/VehicleCargo.js";
import { resolveGroundZForLanding } from "./surfaceHeight.js";

/** Food has no general rigid-body simulation. Only loose items on a tipped bed
 * acquire downhill motion/falling; balls keep their existing projectile path. */
export function tickVehicleCargoPhysics(
  manager: EntityManager,
  props: PropManager,
  dt: number,
  getHeight: (x: number, y: number) => number,
  active: readonly Entity[],
  changed: (actor: Entity) => void,
) {
  const beds = manager.entities.filter((e) => hasVehicleBed(e) && bedTilt(e) > 0);
  for (const actor of active) {
    if (actor.type === "ball" || !isLooseCargo(actor)) continue;
    if (
      actor.jumpVZ === undefined &&
      !beds.some(
        (e) =>
          Math.hypot(e.position.wx - actor.position.wx, e.position.wy - actor.position.wy) < 100,
      )
    )
      continue;
    const beforeX = actor.position.wx,
      beforeY = actor.position.wy,
      beforeZ = actor.wz;
    const nearby = actor.collider ? props.getPropsNearPosition(actor.position, actor.collider) : [];
    slideOnVehicleBed(actor, dt, beds, nearby);
    if (actor.jumpVZ !== undefined) {
      const before = actor.wz ?? 0;
      actor.jumpVZ -= 240 * dt;
      actor.wz = before + actor.jumpVZ * dt;
      const ground = resolveGroundZForLanding(actor, getHeight, nearby, manager.entities, before);
      actor.groundZ = ground;
      if (actor.wz <= ground) {
        actor.wz = ground;
        delete actor.jumpVZ;
        delete actor.jumpZ;
        actor.velocity = null;
      } else actor.jumpZ = actor.wz - ground;
    }
    manager.spatialHash.update(actor);
    if (beforeX !== actor.position.wx || beforeY !== actor.position.wy || beforeZ !== actor.wz)
      changed(actor);
  }
}

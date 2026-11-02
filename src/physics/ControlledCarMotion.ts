import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import { roofSupport } from "../traffic/RoofSupport.js";
import { vehicleNoseHeading } from "../traffic/Vehicle.js";
import { entityBody } from "../traffic/VehicleContact.js";
import { vehiclePerformance } from "../traffic/VehiclePerformance.js";
import type { VehiclePush } from "../traffic/VehiclePush.js";
import type { World } from "../world/World.js";
import type { MovementPhysicsParams } from "./PlayerMovement.js";
import type { PersistentCollisionWorld } from "./rapier/PersistentCollisionWorld.js";
import {
  type CreateMovementContextOptions,
  createMovementContext,
} from "./SimulationEnvironment.js";

/** Keep the driving intent integrator; all contact/support queries use the same
 * persistent world as characters. Passive recipients never acquire car velocity.
 */
export function controlledCarMotion(
  before: Entity,
  desired: Entity,
  dt: number,
  world: World,
  props: readonly Prop[],
  entities: readonly Entity[],
  physics: MovementPhysicsParams,
  collisionWorld: PersistentCollisionWorld,
  pushes: VehiclePush[],
  geometryVersion?: CreateMovementContextOptions["geometryVersion"],
): Entity | undefined {
  if (
    Math.hypot(desired.position.wx - before.position.wx, desired.position.wy - before.position.wy) >
      1e-8 &&
    entities.some(
      (e) =>
        e.id !== before.id &&
        e.parentId === undefined &&
        roofSupport(e, [before])?.id === before.id,
    )
  )
    return collisionWorld.reject("moving roof passengers");
  const actor = {
    ...desired,
    position: { ...before.position },
    velocity: {
      vx: (desired.position.wx - before.position.wx) / dt,
      vy: (desired.position.wy - before.position.wy) / dt,
    },
  };
  const source: CreateMovementContextOptions = {
    collisionWorld,
    ...(geometryVersion ? { geometryVersion } : {}),
    getCollision: (x, y) => world.getCollisionIfLoaded(x, y),
    getHeight: (x, y) => world.getHeightAt(x, y),
    queryProps: () => props,
    queryEntities: () => entities,
    movingEntity: actor,
    excludeIds: new Set([before.id]),
    noclip: false,
    pushBody: (entity, after) =>
      pushes.push({ entity, position: after.position, z: after.wz ?? 0 }),
  };
  const startHeading = vehicleNoseHeading(before);
  const turn = Math.atan2(
    Math.sin(vehicleNoseHeading(desired) - startHeading),
    Math.cos(vehicleNoseHeading(desired) - startHeading),
  );
  if (Math.abs(turn) > 1e-8) {
    const body = entityBody(before),
      radius = Math.hypot(body.halfLength, body.halfWidth);
    const samples = Math.max(1, Math.ceil((radius * Math.abs(turn)) / 0.25));
    if (samples > 64) return collisionWorld.reject("car angular step budget");
    const padding = (radius * Math.abs(turn)) / samples / 16;
    for (let i = 1; i <= samples; i++)
      if (
        !collisionWorld.canOccupy(
          { ...before, vehicleHeading: startHeading + (turn * i) / samples },
          source,
          physics.characterPhysics ?? 3,
          padding,
        )
      )
        return undefined;
  }
  const context = createMovementContext(source);
  context.moveCharacter?.(actor, dt, {
    ...physics,
    walkSpeed: vehiclePerformance(before.type).pushSpeed,
  });
  return actor;
}

import RAPIER from "@dimforge/rapier3d-compat";
import type { Entity } from "../entities/Entity.js";
import { Direction } from "../entities/Entity.js";
import { applyCurveTrainFacing, isCurveTrain } from "../railway/CurveTrain.js";
import { headingFrame } from "../railway/RailPath.js";
import { applyVehicleFacing } from "../traffic/Vehicle.js";
import { yawRotation } from "./BodyRotation.js";
import { PHYSICS_PIXELS_PER_METRE as SCALE } from "./PhysicsDefaults.js";
import type { SceneBody } from "./SceneBody.js";

/** A body still asleep has the pose, velocity and solved contacts already cached:
 * its previous pose catches up and its own contacts are listed again. */
export function keepRest(entry: SceneBody, contacts: Map<number, Set<number>>) {
  const state = entry.state;
  state.prevX = state.x;
  state.prevY = state.y;
  state.prevZ = state.z;
  state.prevHeading = state.heading;
  if (state.rotation) state.prevRotation = state.rotation;
  entry.unmoved = true;
  if (!entry.touching.length) return;
  let neighbors = contacts.get(entry.entity.id);
  if (!neighbors) {
    neighbors = new Set();
    contacts.set(entry.entity.id, neighbors);
  }
  for (const id of entry.touching) neighbors.add(id);
}

/** Publish the cached state to the entity; no physics query except an airborne
 * body's ground probe. Runs for resting bodies too: other systems write pose
 * arcs onto these fields between ticks. */
export function publishBody(
  entry: SceneBody,
  world: RAPIER.World,
  metrics: { supportQueries: number },
) {
  const state = entry.state,
    entity = entry.entity;
  entity.prevPosition = { ...entity.position };
  entity.prevWz = entity.wz ?? 0;
  entity.position.wx = state.x;
  entity.position.wy = state.y;
  entity.wz = state.z;
  if (entity.velocity) {
    entity.velocity.vx = state.vx;
    entity.velocity.vy = state.vy;
  }
  if (state.grounded) {
    delete entity.jumpVZ;
    entity.groundZ = state.z;
    entity.jumpZ = 0;
  } else {
    entity.jumpVZ = state.vz;
    metrics.supportQueries++;
    const p = entry.body.translation();
    const hit = world.castRay(
      new RAPIER.Ray({ x: p.x, y: p.y - entry.halfY + 0.01, z: p.z }, { x: 0, y: -1, z: 0 }),
      512,
      true,
      undefined,
      undefined,
      entry.collider,
    );
    entity.groundZ = hit ? state.z + 0.16 - hit.timeOfImpact * SCALE : state.z;
    entity.jumpZ = Math.max(0, state.z - entity.groundZ);
  }
  state.groundZ = entity.groundZ ?? state.z;
  entry.bed?.publish(entity, state, entry.collider);
  if (entry.kind === "vehicle") publishVehicle(entity, state);
  entity.jumpInputState = state.jumpHeld ? 3 : 0;
}

function publishVehicle(entity: Entity, state: SceneBody["state"]) {
  const rotation = state.rotation ?? yawRotation(state.heading);
  entity.prevBodyRotation = state.prevRotation ?? rotation;
  entity.bodyRotation = rotation;
  entity.bodyAngularVelocity = state.angularVelocity ?? [0, 0, 0];
  entity.prevVehicleHeading = entity.vehicleHeading ?? state.heading;
  entity.vehicleHeading = state.heading;
  const x = Math.cos(state.heading),
    y = Math.sin(state.heading);
  applyVehicleFacing(
    entity,
    Math.abs(x) >= Math.abs(y)
      ? x >= 0
        ? Direction.Right
        : Direction.Left
      : y >= 0
        ? Direction.Down
        : Direction.Up,
  );
  if (isCurveTrain(entity) && entity.sprite) {
    entity.sprite.frameRow = headingFrame(state.heading);
    applyCurveTrainFacing(entity);
  }
  if (entity.sprite) entity.sprite.moving = Math.hypot(state.vx, state.vy) > 1;
}

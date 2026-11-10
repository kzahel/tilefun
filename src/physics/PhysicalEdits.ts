import type { ColliderComponent, Entity, VelocityComponent } from "../entities/Entity.js";
import { wake } from "../entities/naps.js";

export interface BodyPose {
  wx: number;
  wy: number;
  wz: number;
}
export interface BodyVelocity extends VelocityComponent {
  vz: number;
}
function finite(values: readonly number[]) {
  if (!values.every(Number.isFinite))
    throw Error("Physical edits require finite coordinates and velocities.");
}

/** Explicit relocation preserving motion. Admission/readback belongs to PhysicsScene;
 * these helpers also work before spawn and while a body is outside the active scene. */
export function setBodyPose(entity: Entity, pose: Partial<BodyPose>): void {
  wake(entity);
  finite(Object.values(pose));
  if (pose.wx !== undefined) entity.position.wx = pose.wx;
  if (pose.wy !== undefined) entity.position.wy = pose.wy;
  if (pose.wz !== undefined) entity.wz = pose.wz;
}

export function setHorizontalVelocity(entity: Entity, velocity: VelocityComponent | null): void {
  wake(entity);
  if (!velocity) {
    entity.velocity = null;
    return;
  }
  finite([velocity.vx, velocity.vy]);
  entity.velocity ??= { vx: 0, vy: 0 };
  entity.velocity.vx = velocity.vx;
  entity.velocity.vy = velocity.vy;
}
export function setVerticalVelocity(entity: Entity, vz: number): void {
  wake(entity);
  finite([vz]);
  entity.jumpVZ = vz;
}
/** Assign a launch velocity once; continuous movement uses MotionIntent. */
export function launchBody(entity: Entity, velocity: BodyVelocity): void {
  finite([velocity.vx, velocity.vy, velocity.vz]);
  setHorizontalVelocity(entity, velocity);
  setVerticalVelocity(entity, velocity.vz);
}

/** A stopped relocation: no interpolation trail, jump or inherited velocity. */
export function teleportBody(entity: Entity, pose: BodyPose): void {
  finite([pose.wx, pose.wy, pose.wz]);
  setBodyPose(entity, pose);
  entity.prevPosition = { ...entity.position };
  entity.prevWz = pose.wz;
  entity.groundZ = pose.wz;
  entity.jumpZ = 0;
  delete entity.jumpVZ;
  if (entity.velocity) setHorizontalVelocity(entity, { vx: 0, vy: 0 });
}

/** Shape membership/rebuild is admitted by the same scene synchronization as poses. */
export function replaceBodyCollider(entity: Entity, collider: ColliderComponent | null): void {
  entity.collider = collider ? { ...collider } : null;
}

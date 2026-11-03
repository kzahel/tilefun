import { JUMP_GRAVITY, JUMP_VELOCITY } from "../config/constants.js";
import { getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import { isTrain } from "../railway/Train.js";
import { rotateBodyVector, yawRotation } from "./BodyRotation.js";
import { physicsBodyDimensions } from "./PhysicsBodies.js";
import type { PhysicsBodyState } from "./PhysicsState.js";

/** A grounded jump near a reachable rideable roof gets just enough extra height.
 * Shared authority/replay policy, evaluated only at the jump edge. No pose writes. */
export function assistedJumpVelocity(
  actor: Entity,
  state: PhysicsBodyState,
  bodies: Iterable<{ entity: Entity; state: PhysicsBodyState }>,
  gravity: number,
): number {
  if (actor.type !== "player" || !actor.collider || gravity <= 0) return JUMP_VELOCITY;
  const feet = getEntityAABB({ wx: state.x, wy: state.y }, actor.collider);
  let height = 0;
  for (const other of bodies) {
    const e = other.entity;
    if (e.id === actor.id || !e.collider || (!e.type.startsWith("vehicle-v1:") && !isTrain(e)))
      continue;
    const d = physicsBodyDimensions(e),
      q = other.state.rotation ?? yawRotation(d.yaw);
    let left = Infinity,
      right = -Infinity,
      top = Infinity,
      bottom = -Infinity,
      roof = -Infinity;
    for (const x of [-d.width / 2, d.width / 2])
      for (const y of [-d.depth / 2, d.depth / 2])
        for (const z of [0, d.height]) {
          const p = rotateBodyVector(q, x, y, z);
          left = Math.min(left, other.state.x + d.offsetX + p.x);
          right = Math.max(right, other.state.x + d.offsetX + p.x);
          top = Math.min(top, other.state.y + d.offsetY + p.y);
          bottom = Math.max(bottom, other.state.y + d.offsetY + p.y);
          roof = Math.max(roof, other.state.z + p.z);
        }
    const rise = roof - state.z;
    const gap = Math.hypot(
      Math.max(left - feet.right, feet.left - right, 0),
      Math.max(top - feet.bottom, feet.top - bottom, 0),
    );
    if (gap <= 24 && rise > 4 && rise <= 60) height = Math.max(height, rise + 6);
  }
  return Math.max(JUMP_VELOCITY, Math.sqrt(2 * JUMP_GRAVITY * gravity * height));
}

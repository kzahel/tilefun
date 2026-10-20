import { type AABB, aabbsOverlap } from "../entities/collision.js";

/** Permit only monotonic escape from an existing overlap. Never admit a new
 * contact, a deeper penetration or a stationary/sideways move inside a body. */
export function separatesContact(before: AABB, after: AABB, obstacle: AABB): boolean {
  if (!aabbsOverlap(before, obstacle)) return false;
  const x = Math.min(before.right - obstacle.left, obstacle.right - before.left);
  const y = Math.min(before.bottom - obstacle.top, obstacle.bottom - before.top);
  const nextX = Math.min(after.right - obstacle.left, obstacle.right - after.left);
  const nextY = Math.min(after.bottom - obstacle.top, obstacle.bottom - after.top);
  // Minimum translation depth measures progress toward the nearest exit face.
  // A diagonal retreat may move toward the obstacle on the other axis; forbidding
  // that would trap a car whose nose is not aligned with the contact normal.
  return Math.min(nextX, nextY) < Math.min(x, y) - 1e-9;
}

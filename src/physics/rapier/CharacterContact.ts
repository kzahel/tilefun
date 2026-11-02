import type { Collider, Vector } from "@dimforge/rapier3d-compat";

/** Above a peer, ascending motion separates vertically. Sweep the actual hulls
 * and restrict closing horizontal travel without handing ascent to slope sliding.
 */
export function constrainCharacterAscent(
  collider: Collider,
  peer: Collider,
  move: Vector,
  skin: number,
) {
  for (let i = 0; i < 4; i++) {
    const hit = collider.castCollider(move, peer, { x: 0, y: 0, z: 0 }, skin, 1, false);
    if (!hit) return;
    const n = hit.normal1;
    if (move.x * n.x + move.y * n.y + move.z * n.z <= 1e-6) return;
    const fraction = Math.max(0, hit.time_of_impact - 0.001);
    move.x *= fraction;
    move.z *= fraction;
  }
  move.x = move.z = 0;
}

/** Only overlapping vertical sides participate in controlled pushing. Capsule
 * caps are support/ceiling surfaces even where a shoulder normal looks sideways.
 */
export function characterSidesOverlap(
  firstY: number,
  firstSideHalfHeight: number,
  secondY: number,
  secondSideHalfHeight: number,
  tolerance: number,
) {
  return Math.abs(firstY - secondY) < firstSideHalfHeight + secondSideHalfHeight - tolerance;
}

/** A side constraint can shorten horizontal proposals, never a jump/fall. */
export function guardCharacterSideContact(
  first: Vector,
  second: Vector,
  normal: Vector,
  time: number,
) {
  const closing = (first.x - second.x) * normal.x + (first.z - second.z) * normal.z;
  if (Math.abs(normal.y) >= 0.5 || closing <= 1e-6) return;
  const fraction = Math.max(0, time - 0.001);
  for (const move of [first, second]) {
    move.x *= fraction;
    move.z *= fraction;
  }
}

/** Relative support/ceiling constraint. Only approaching vertical intent is
 * consumed; a stationary support never receives the rider's walking impulse.
 */
export function guardCharacterCapContact(
  first: Vector,
  second: Vector,
  normal: Vector,
  time: number,
) {
  guardCharacterSideContact(first, second, { x: normal.x, y: 0, z: normal.z }, time);
  const up = Math.sign(normal.y);
  const firstIn = first.y * up,
    secondIn = -second.y * up;
  const closing = firstIn + secondIn;
  const inward = Math.max(0, firstIn) + Math.max(0, secondIn);
  if (closing <= 1e-6 || inward <= 1e-6) return;
  const remove = closing * (1 - Math.max(0, time - 0.001));
  first.y -= (up * remove * Math.max(0, firstIn)) / inward;
  second.y += (up * remove * Math.max(0, secondIn)) / inward;
}

/** Shared controlled-motor response: current proposals only, never solved-body carry. */
export function shareCharacterContact(
  first: Vector,
  second: Vector,
  normal: Vector,
  time: number,
  walkStep: number,
) {
  // The engine resolves support/ceiling geometry. This response shares only
  // current horizontal motor proposals, not vertical momentum or support carry.
  const horizontal = Math.hypot(normal.x, normal.z);
  if (Math.abs(normal.y) >= 0.5 || horizontal < 1e-6) return undefined;
  normal = { x: normal.x / horizontal, y: 0, z: normal.z / horizontal };
  const firstIn = first.x * normal.x + first.y * normal.y + first.z * normal.z;
  const secondIn = -(second.x * normal.x + second.y * normal.y + second.z * normal.z);
  const closing = firstIn + secondIn;
  if (closing <= 1e-6) return undefined;
  const remove = closing * (1 - Math.max(0, time - 0.001));
  const firstShare = remove * 0.5;
  const secondShare = remove - firstShare;
  const budgets = [first, second].map((move) => Math.max(walkStep, Math.hypot(move.x, move.z)));
  first.x -= normal.x * firstShare;
  first.y -= normal.y * firstShare;
  first.z -= normal.z * firstShare;
  second.x += normal.x * secondShare;
  second.y += normal.y * secondShare;
  second.z += normal.z * secondShare;
  for (const [index, move] of [first, second].entries()) {
    const length = Math.hypot(move.x, move.z),
      budget = budgets[index] ?? 0;
    if (length > budget) {
      move.x *= budget / length;
      move.z *= budget / length;
    }
  }
  return { firstIn, secondIn };
}

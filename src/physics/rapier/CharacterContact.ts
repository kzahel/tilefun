import type { Vector } from "@dimforge/rapier3d-compat";

/** Shared controlled-motor response: current proposals only, never solved-body carry. */
export function shareCharacterContact(
  first: Vector,
  second: Vector,
  normal: Vector,
  time: number,
  walkStep: number,
) {
  const firstIn = first.x * normal.x + first.y * normal.y + first.z * normal.z;
  const secondIn = -(second.x * normal.x + second.y * normal.y + second.z * normal.z);
  const closing = firstIn + secondIn;
  if (closing <= 1e-6) return undefined;
  const inward = Math.max(0, firstIn) + Math.max(0, secondIn);
  const remove = closing * (1 - Math.max(0, time - 0.001));
  const side = Math.abs(normal.y) < 0.5;
  const firstShare = remove * (side ? 0.5 : Math.max(0, firstIn) / inward);
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

/** Same point-radius hit rule on authority and replicas. */
export const BEFRIEND_RANGE = 24;
export function isBefriendHit(
  wx: number,
  wy: number,
  x: number,
  y: number,
  eligible: boolean,
): boolean {
  return eligible && (wx - x) ** 2 + (wy - y) ** 2 <= BEFRIEND_RANGE ** 2;
}

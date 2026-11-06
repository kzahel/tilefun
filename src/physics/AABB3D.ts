/** Check if two entities overlap in the Z axis. */
export function zRangesOverlap(
  aWz: number,
  aHeight: number,
  bWz: number,
  bHeight: number,
): boolean {
  return aWz < bWz + bHeight && aWz + aHeight > bWz;
}

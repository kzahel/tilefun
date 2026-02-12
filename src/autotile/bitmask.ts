/**
 * 8-bit blob autotile bitmask bits.
 * Cardinal bits: N(1) W(2) E(4) S(8)
 * Diagonal bits: NW(16) NE(32) SW(64) SE(128)
 * Diagonal bits only count when BOTH adjacent cardinals are set.
 */
export const AutotileBit = {
  N: 1,
  W: 2,
  E: 4,
  S: 8,
  NW: 16,
  NE: 32,
  SW: 64,
  SE: 128,
} as const;

/**
 * Strip diagonal bits where the adjacent cardinals are not both present.
 * This collapses the 256 possible 8-bit masks to 47 canonical forms.
 */
export function canonicalize(mask: number): number {
  let result = mask & 0x0f; // Keep cardinal bits
  if (mask & AutotileBit.N && mask & AutotileBit.W) result |= mask & AutotileBit.NW;
  if (mask & AutotileBit.N && mask & AutotileBit.E) result |= mask & AutotileBit.NE;
  if (mask & AutotileBit.S && mask & AutotileBit.W) result |= mask & AutotileBit.SW;
  if (mask & AutotileBit.S && mask & AutotileBit.E) result |= mask & AutotileBit.SE;
  return result;
}

/**
 * Force all diagonal bits ON when both adjacent cardinals are set.
 * This collapses 47 canonical masks to ~10 "convex" shapes — the same
 * set produced by the old corner/dual-grid system. No concave cutouts.
 */
export function convexify(mask: number): number {
  let result = mask;
  if (mask & AutotileBit.N && mask & AutotileBit.W) result |= AutotileBit.NW;
  if (mask & AutotileBit.N && mask & AutotileBit.E) result |= AutotileBit.NE;
  if (mask & AutotileBit.S && mask & AutotileBit.W) result |= AutotileBit.SW;
  if (mask & AutotileBit.S && mask & AutotileBit.E) result |= AutotileBit.SE;
  return result;
}

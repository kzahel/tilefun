import { GM_BLOB_LOOKUP } from "../autotile/gmBlobLayout.js";

/**
 * 4-bit NSEW cardinal direction bits.
 * N=1, W=2, E=4, S=8 (matches gmBlobLayout.ts convention).
 */
const N = 1;
const W = 2;
const E = 4;
const S = 8;

/**
 * Compute 4-bit NSEW cardinal mask: which cardinal neighbors match the center road type?
 */
export function computeRoadCardinalMask(
  center: number,
  n: number,
  e: number,
  s: number,
  w: number,
): number {
  let mask = 0;
  if (n === center) mask |= N;
  if (e === center) mask |= E;
  if (s === center) mask |= S;
  if (w === center) mask |= W;
  return mask;
}

/**
 * Convert a 4-bit NSEW mask to an 8-bit blob mask by setting diagonal bits
 * when both adjacent cardinals are set.
 */
export function nsewToBlobMask(nsew: number): number {
  let result = nsew;
  if (nsew & N && nsew & W) result |= 16; // NW
  if (nsew & N && nsew & E) result |= 32; // NE
  if (nsew & S && nsew & W) result |= 64; // SW
  if (nsew & S && nsew & E) result |= 128; // SE
  return result;
}

/**
 * Get the (col, row) sprite position in a GM blob 12x4 autotile sheet
 * for a 4-bit NSEW mask.
 */
export function getRoadSprite(nsewMask: number): { col: number; row: number } {
  const blobMask = nsewToBlobMask(nsewMask);
  const packed = GM_BLOB_LOOKUP[blobMask & 0xff] ?? 0;
  return { col: packed & 0xff, row: packed >> 8 };
}

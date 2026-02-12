import { AutotileBit } from "./bitmask.js";

/**
 * Compute an 8-bit blob autotile mask from 4 corner booleans.
 *
 * Each boolean indicates whether the corner belongs to the "in" terrain.
 * Cardinals are set when both adjacent corners agree; diagonals require
 * both adjacent cardinals AND the corner itself.
 *
 * Returns a canonical mask (0–255) suitable for GM_BLOB_LOOKUP.
 */
export function computeCornerMask(
  nw: boolean,
  ne: boolean,
  sw: boolean,
  se: boolean,
): number {
  const n = nw && ne;
  const s = sw && se;
  const w = nw && sw;
  const e = ne && se;

  let mask = 0;
  if (n) mask |= AutotileBit.N;
  if (w) mask |= AutotileBit.W;
  if (e) mask |= AutotileBit.E;
  if (s) mask |= AutotileBit.S;
  if (n && w && nw) mask |= AutotileBit.NW;
  if (n && e && ne) mask |= AutotileBit.NE;
  if (s && w && sw) mask |= AutotileBit.SW;
  if (s && e && se) mask |= AutotileBit.SE;

  return mask;
}

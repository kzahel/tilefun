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
export function computeCornerMask(nw: boolean, ne: boolean, sw: boolean, se: boolean): number {
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

/**
 * Compute an 8-bit blob autotile mask from 4 corner booleans using OR for
 * cardinal directions. This produces correct masks for terrain blending.
 *
 * Cardinals use OR: the terrain "extends" in a direction if EITHER corner
 * on that shared edge matches. This enables all 47 canonical GM blob masks,
 * unlike computeCornerMask (AND) which only produces 10.
 *
 * Example: corners (T,T,T,F) with AND → mask 19 (outer convex, ~25% fill).
 * With OR → mask 127 (inner concave, ~90% fill with tiny cutout in SE).
 */
export function computeBlendMask(nw: boolean, ne: boolean, sw: boolean, se: boolean): number {
  const n = nw || ne;
  const s = sw || se;
  const w = nw || sw;
  const e = ne || se;

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

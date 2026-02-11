import { canonicalize } from "./bitmask.js";

/**
 * GM blob autotile layout for Modern Exteriors (LimeZu): 12×4 grid, 47 unique + 1 unused at (0,0).
 *
 * Each entry: [canonicalMask, col, row] where col/row are 0-indexed in the 12×4 grid.
 * Bitmask uses our convention: N=1, W=2, E=4, S=8, NW=16, NE=32, SW=64, SE=128.
 *
 * Extracted by pixel-diffing actual ME autotile sheets against the solid-fill (mask 255) tile,
 * verified identical across multiple sheets (me-autotile-02.png, me-autotile-07.png).
 */
export const GM_BLOB_47: ReadonlyArray<readonly [mask: number, col: number, row: number]> = [
  // Row 0: (0,0) unused — full interior descending to 3-corner combos
  [255, 1, 0], // Full interior (all neighbors)
  [239, 2, 0], // N+W+E+S+NE+SW+SE
  [223, 3, 0], // N+W+E+S+NW+SW+SE
  [207, 4, 0], // N+W+E+S+SW+SE
  [127, 5, 0], // N+W+E+S+NW+NE+SW
  [111, 6, 0], // N+W+E+S+NE+SW
  [95, 7, 0], // N+W+E+S+NW+SW
  [79, 8, 0], // N+W+E+S+SW
  [191, 9, 0], // N+W+E+S+NW+NE+SE
  [175, 10, 0], // N+W+E+S+NE+SE
  [159, 11, 0], // N+W+E+S+NW+SE

  // Row 1: 2-corner combos, all-cardinals, and SE/SW starts
  [143, 0, 1], // N+W+E+S+SE
  [63, 1, 1], // N+W+E+S+NW+NE
  [47, 2, 1], // N+W+E+S+NE
  [31, 3, 1], // N+W+E+S+NW
  [15, 4, 1], // N+W+E+S (all cardinals, no corners)
  [173, 5, 1], // N+E+S+NE+SE
  [141, 6, 1], // N+E+S+SE
  [45, 7, 1], // N+E+S+NE
  [13, 8, 1], // N+E+S
  [206, 9, 1], // W+E+S+SW+SE
  [78, 10, 1], // W+E+S+SW
  [142, 11, 1], // W+E+S+SE

  // Row 2: 3-cardinal combos with corners
  [14, 0, 2], // W+E+S
  [91, 1, 2], // N+W+S+NW+SW
  [27, 2, 2], // N+W+S+NW
  [75, 3, 2], // N+W+S+SW
  [11, 4, 2], // N+W+S
  [55, 5, 2], // N+W+E+NW+NE
  [39, 6, 2], // N+W+E+NE
  [23, 7, 2], // N+W+E+NW
  [7, 8, 2], // N+W+E
  [9, 9, 2], // N+S
  [6, 10, 2], // W+E
  [140, 11, 2], // E+S+SE

  // Row 3: 2-cardinal combos, single cardinals, isolated
  [12, 0, 3], // E+S
  [74, 1, 3], // W+S+SW
  [10, 2, 3], // W+S
  [19, 3, 3], // N+W+NW
  [3, 4, 3], // N+W
  [37, 5, 3], // N+E+NE
  [5, 6, 3], // N+E
  [8, 7, 3], // S
  [4, 8, 3], // E
  [1, 9, 3], // N
  [2, 10, 3], // W
  [0, 11, 3], // Isolated (no neighbors)
];

/**
 * Pre-built lookup: mask (0-255) → packed GM blob grid position.
 * Packed as (row << 8) | col. Same packing as existing autotile caches.
 */
export const GM_BLOB_LOOKUP: Uint16Array = buildGmBlobLookup();

/** Get the autotile (col, row) in a GM blob 12×4 sheet for a given 8-bit bitmask. */
export function getGmBlobSprite(mask: number): { col: number; row: number } {
  const packed = GM_BLOB_LOOKUP[mask & 0xff] ?? 0;
  return { col: packed & 0xff, row: packed >> 8 };
}

function buildGmBlobLookup(): Uint16Array {
  const lookup = new Uint16Array(256);

  const canonicalMap = new Map<number, number>();
  for (const [mask, col, row] of GM_BLOB_47) {
    canonicalMap.set(mask, (row << 8) | col);
  }

  // Fallback: isolated tile (mask 0)
  const fallback = canonicalMap.get(0) ?? 0;

  for (let m = 0; m < 256; m++) {
    const canonical = canonicalize(m);
    let packed = canonicalMap.get(canonical);
    if (packed === undefined) {
      // Fill all valid diagonals and try again
      const filled = fillAllDiagonals(canonical);
      packed = canonicalMap.get(filled) ?? fallback;
    }
    lookup[m] = packed;
  }
  return lookup;
}

function fillAllDiagonals(mask: number): number {
  let result = mask;
  if (mask & 1 && mask & 2) result |= 16; // N+W → NW
  if (mask & 1 && mask & 4) result |= 32; // N+E → NE
  if (mask & 8 && mask & 2) result |= 64; // S+W → SW
  if (mask & 8 && mask & 4) result |= 128; // S+E → SE
  return result;
}

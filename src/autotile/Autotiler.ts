import { CHUNK_SIZE } from "../config/constants.js";
import type { Chunk } from "../world/Chunk.js";
import { TileId } from "../world/TileRegistry.js";

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
 * 47 canonical bitmask → (col, row) in Grass.png.
 * Extracted from Maaack/Sprout-Lands-Tilemap Godot .tscn terrain peering data.
 * 256 possible masks collapse to these 47 unique variants via diagonal masking.
 */
const AUTOTILE_47: ReadonlyArray<readonly [mask: number, col: number, row: number]> = [
	[0, 1, 2], // Isolated (no grass neighbors)
	[1, 0, 5], // N
	[2, 3, 6], // W
	[3, 5, 7], // N+W
	[4, 0, 6], // E
	[5, 4, 7], // N+E
	[6, 1, 6], // W+E
	[7, 9, 2], // N+W+E
	[8, 0, 2], // S
	[9, 0, 3], // N+S
	[10, 5, 6], // W+S
	[11, 8, 2], // N+W+S
	[12, 4, 6], // E+S
	[13, 9, 3], // N+E+S
	[14, 8, 3], // W+E+S
	[15, 0, 7], // N+W+E+S (all cardinals, no corners)
	[19, 3, 5], // N+W+NW
	[23, 9, 5], // N+W+E+NW
	[27, 7, 5], // N+W+S+NW
	[31, 7, 3], // N+W+E+S+NW
	[37, 1, 5], // N+E+NE
	[39, 6, 5], // N+W+E+NE
	[45, 8, 5], // N+E+S+NE
	[47, 6, 3], // N+W+E+S+NE
	[55, 2, 5], // N+W+E+NW+NE
	[63, 6, 7], // N+W+E+S+NW+NE
	[74, 3, 3], // W+S+SW
	[75, 9, 4], // N+W+S+SW
	[78, 7, 4], // W+E+S+SW
	[79, 7, 2], // N+W+E+S+SW
	[91, 3, 4], // N+W+S+NW+SW
	[95, 7, 7], // N+W+E+S+NW+SW
	[111, 3, 7], // N+W+E+S+NE+SW
	[127, 4, 4], // N+W+E+S+NW+NE+SW
	[140, 1, 3], // E+S+SE
	[141, 6, 4], // N+E+S+SE
	[142, 8, 4], // W+E+S+SE
	[143, 6, 2], // N+W+E+S+SE
	[159, 2, 7], // N+W+E+S+NW+SE
	[173, 1, 4], // N+E+S+NE+SE
	[175, 6, 6], // N+W+E+S+NE+SE
	[191, 5, 4], // N+W+E+S+NW+NE+SE
	[206, 2, 3], // W+E+S+SW+SE
	[207, 7, 6], // N+W+E+S+SW+SE
	[223, 4, 5], // N+W+E+S+NW+SW+SE
	[239, 5, 5], // N+W+E+S+NE+SW+SE
	[255, 2, 4], // Full interior (all neighbors grass)
];

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
 * Pre-built lookup: mask (0-255) → packed autotile position.
 * Packed as (row << 8) | col. Value > 0 since min row is 2.
 */
function buildLookup(): Uint16Array {
	const lookup = new Uint16Array(256);

	// Build canonical map from the 47 entries
	const canonicalMap = new Map<number, number>();
	for (const [mask, col, row] of AUTOTILE_47) {
		canonicalMap.set(mask, (row << 8) | col);
	}

	// Fallback: isolated grass tile
	const fallback = canonicalMap.get(0) ?? (2 << 8) | 1;

	for (let m = 0; m < 256; m++) {
		const canonical = canonicalize(m);
		lookup[m] = canonicalMap.get(canonical) ?? fallback;
	}
	return lookup;
}

const LOOKUP = buildLookup();

/** Check if a tile ID belongs to the "grass" autotile group. */
export function isGrassGroup(tileId: TileId): boolean {
	return tileId === TileId.Grass || tileId === TileId.Forest || tileId === TileId.DenseForest;
}

/** Get the autotile (col, row) in Grass.png for a given 8-bit bitmask. */
export function getAutotileSprite(mask: number): { col: number; row: number } {
	const packed = LOOKUP[mask & 0xff] ?? (2 << 8) | 1;
	return { col: packed & 0xff, row: packed >> 8 };
}

/**
 * Compute the 8-bit blob bitmask for a grass tile at global position (tx, ty).
 * Queries neighbors via the provided callback. Diagonal bits are only set
 * when both adjacent cardinals are also grass.
 */
export function computeMask(
	tx: number,
	ty: number,
	getTerrain: (tx: number, ty: number) => TileId,
): number {
	let mask = 0;

	const n = isGrassGroup(getTerrain(tx, ty - 1));
	const w = isGrassGroup(getTerrain(tx - 1, ty));
	const e = isGrassGroup(getTerrain(tx + 1, ty));
	const s = isGrassGroup(getTerrain(tx, ty + 1));

	if (n) mask |= AutotileBit.N;
	if (w) mask |= AutotileBit.W;
	if (e) mask |= AutotileBit.E;
	if (s) mask |= AutotileBit.S;

	if (n && w && isGrassGroup(getTerrain(tx - 1, ty - 1))) mask |= AutotileBit.NW;
	if (n && e && isGrassGroup(getTerrain(tx + 1, ty - 1))) mask |= AutotileBit.NE;
	if (s && w && isGrassGroup(getTerrain(tx - 1, ty + 1))) mask |= AutotileBit.SW;
	if (s && e && isGrassGroup(getTerrain(tx + 1, ty + 1))) mask |= AutotileBit.SE;

	return mask;
}

/**
 * Compute autotile for an entire chunk, filling its autotileCache.
 * For grass tiles, stores packed (row << 8 | col) in Grass.png.
 * For non-grass tiles, stores 0 (use regular tile definition).
 *
 * @param getTerrain - Returns terrain TileId at global tile coords.
 *   Should NOT create new chunks (use a "safe" variant).
 */
export function computeChunkAutotile(
	chunk: Chunk,
	cx: number,
	cy: number,
	getTerrain: (tx: number, ty: number) => TileId,
): void {
	const baseX = cx * CHUNK_SIZE;
	const baseY = cy * CHUNK_SIZE;

	for (let ly = 0; ly < CHUNK_SIZE; ly++) {
		for (let lx = 0; lx < CHUNK_SIZE; lx++) {
			const tileId = chunk.getTerrain(lx, ly);
			if (isGrassGroup(tileId)) {
				const tx = baseX + lx;
				const ty = baseY + ly;
				const mask = computeMask(tx, ty, getTerrain);
				const { col, row } = getAutotileSprite(mask);
				chunk.autotileCache[ly * CHUNK_SIZE + lx] = (row << 8) | col;
			} else {
				chunk.autotileCache[ly * CHUNK_SIZE + lx] = 0;
			}
		}
	}
}

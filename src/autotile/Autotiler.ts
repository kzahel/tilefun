import { CHUNK_SIZE } from "../config/constants.js";
import type { Chunk } from "../world/Chunk.js";
import { TileId } from "../world/TileRegistry.js";
import { AutotileBit } from "./bitmask.js";
import { GM_BLOB_LOOKUP } from "./gmBlobLayout.js";

export { AutotileBit, canonicalize } from "./bitmask.js";

/** Check if a tile ID belongs to the "grass" autotile group (includes Sand). */
export function isGrassGroup(tileId: TileId): boolean {
	return (
		tileId === TileId.Grass ||
		tileId === TileId.Forest ||
		tileId === TileId.DenseForest ||
		tileId === TileId.Sand
	);
}

/** Check if a tile ID belongs to the "dirt" autotile group. */
export function isDirtGroup(tileId: TileId): boolean {
	return tileId === TileId.Sand;
}

/**
 * Compute the 8-bit blob bitmask for a tile at global position (tx, ty).
 * Queries neighbors via the provided callback. Diagonal bits are only set
 * when both adjacent cardinals are also in the group.
 */
export function computeMask(
	tx: number,
	ty: number,
	getTerrain: (tx: number, ty: number) => TileId,
	isInGroup: (tileId: TileId) => boolean = isGrassGroup,
): number {
	let mask = 0;

	const n = isInGroup(getTerrain(tx, ty - 1));
	const w = isInGroup(getTerrain(tx - 1, ty));
	const e = isInGroup(getTerrain(tx + 1, ty));
	const s = isInGroup(getTerrain(tx, ty + 1));

	if (n) mask |= AutotileBit.N;
	if (w) mask |= AutotileBit.W;
	if (e) mask |= AutotileBit.E;
	if (s) mask |= AutotileBit.S;

	if (n && w && isInGroup(getTerrain(tx - 1, ty - 1))) mask |= AutotileBit.NW;
	if (n && e && isInGroup(getTerrain(tx + 1, ty - 1))) mask |= AutotileBit.NE;
	if (s && w && isInGroup(getTerrain(tx - 1, ty + 1))) mask |= AutotileBit.SW;
	if (s && e && isInGroup(getTerrain(tx + 1, ty + 1))) mask |= AutotileBit.SE;

	return mask;
}

/**
 * Compute autotile for an entire chunk, filling its autotileCache.
 * For grass-group tiles, stores packed (row << 8 | col) in GM blob grid.
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
				chunk.autotileCache[ly * CHUNK_SIZE + lx] =
					GM_BLOB_LOOKUP[mask & 0xff]!;
			} else {
				chunk.autotileCache[ly * CHUNK_SIZE + lx] = 0;
			}
		}
	}
}

/**
 * Compute dirt autotile for an entire chunk, filling its dirtAutotileCache.
 * For dirt-group tiles (Sand), stores packed (row << 8 | col) in GM blob grid.
 * For non-dirt tiles, stores 0.
 */
export function computeChunkDirtAutotile(
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
			if (isDirtGroup(tileId)) {
				const tx = baseX + lx;
				const ty = baseY + ly;
				const mask = computeMask(tx, ty, getTerrain, isDirtGroup);
				chunk.dirtAutotileCache[ly * CHUNK_SIZE + lx] =
					GM_BLOB_LOOKUP[mask & 0xff]!;
			} else {
				chunk.dirtAutotileCache[ly * CHUNK_SIZE + lx] = 0;
			}
		}
	}
}

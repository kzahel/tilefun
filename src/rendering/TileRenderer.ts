import type { Spritesheet } from "../assets/Spritesheet.js";
import {
	CHUNK_SIZE,
	PIXEL_SCALE,
	TILE_SIZE,
	WATER_FRAME_COUNT,
	WATER_FRAME_DURATION_MS,
} from "../config/constants.js";
import type { Chunk } from "../world/Chunk.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import { getTileDef, TileId } from "../world/TileRegistry.js";
import { chunkToWorld } from "../world/types.js";
import type { World } from "../world/World.js";
import type { Camera } from "./Camera.js";

const CHUNK_NATIVE_PX = CHUNK_SIZE * TILE_SIZE;
const SCALED_TILE = TILE_SIZE * PIXEL_SCALE;

/** Compute the current water animation frame index from a timestamp. */
export function getWaterFrame(nowMs: number): number {
	return Math.floor(nowMs / WATER_FRAME_DURATION_MS) % WATER_FRAME_COUNT;
}

/**
 * Chunk-cached tile renderer. Each chunk is pre-rendered to an OffscreenCanvas
 * at native resolution (256x256), then drawn scaled to the main canvas.
 * Includes both terrain (with autotile) and detail layers in the cache.
 */
export class TileRenderer {
	private readonly chunkScreenSize = CHUNK_SIZE * TILE_SIZE * PIXEL_SCALE;

	/**
	 * Draw all visible chunks from their cached OffscreenCanvas.
	 * Terrain, autotile, and detail layers are all included in the cache.
	 */
	drawTerrain(
		ctx: CanvasRenderingContext2D,
		camera: Camera,
		world: World,
		sheets: Map<string, Spritesheet>,
		visible: ChunkRange,
	): void {
		const waterSheet = sheets.get("water");
		const waterFrame = getWaterFrame(performance.now());

		for (let cy = visible.minCy; cy <= visible.maxCy; cy++) {
			for (let cx = visible.minCx; cx <= visible.maxCx; cx++) {
				const chunk = world.getChunk(cx, cy);
				const origin = chunkToWorld(cx, cy);
				const screenOrigin = camera.worldToScreen(origin.wx, origin.wy);

				const sx = Math.round(screenOrigin.sx);
				const sy = Math.round(screenOrigin.sy);

				// Chunk-level frustum cull
				if (
					sx + this.chunkScreenSize < 0 ||
					sy + this.chunkScreenSize < 0 ||
					sx > ctx.canvas.width ||
					sy > ctx.canvas.height
				) {
					continue;
				}

				// Rebuild cache if stale or missing
				if (chunk.dirty || !chunk.renderCache) {
					this.rebuildCache(chunk, sheets);
					chunk.dirty = false;
				}

				if (chunk.renderCache) {
					// Draw 1px oversize to prevent sub-pixel seams between chunks
					ctx.drawImage(
						chunk.renderCache,
						sx,
						sy,
						this.chunkScreenSize + 1,
						this.chunkScreenSize + 1,
					);
				}

				// Overlay animated water tiles on top of the static cache
				if (waterSheet) {
					for (let ly = 0; ly < CHUNK_SIZE; ly++) {
						for (let lx = 0; lx < CHUNK_SIZE; lx++) {
							const tileId = chunk.getTerrain(lx, ly);
							if (tileId === TileId.Water || tileId === TileId.DeepWater) {
								waterSheet.drawTile(
									ctx,
									waterFrame,
									0,
									sx + lx * SCALED_TILE,
									sy + ly * SCALED_TILE,
									PIXEL_SCALE,
								);
							}
						}
					}
				}
			}
		}
	}

	/**
	 * Rebuild the chunk's OffscreenCanvas cache.
	 * Draws terrain (with autotile for grass) and detail tiles at native resolution.
	 */
	private rebuildCache(chunk: Chunk, sheets: Map<string, Spritesheet>): void {
		if (!chunk.renderCache) {
			chunk.renderCache = new OffscreenCanvas(CHUNK_NATIVE_PX, CHUNK_NATIVE_PX);
		}
		const offCtx = chunk.renderCache.getContext("2d");
		if (!offCtx) return;
		offCtx.imageSmoothingEnabled = false;
		offCtx.clearRect(0, 0, CHUNK_NATIVE_PX, CHUNK_NATIVE_PX);

		const grassSheet = sheets.get("grass");
		const waterSheet = sheets.get("water");
		const dirtSheet = sheets.get("dirt");

		for (let ly = 0; ly < CHUNK_SIZE; ly++) {
			for (let lx = 0; lx < CHUNK_SIZE; lx++) {
				const dx = lx * TILE_SIZE;
				const dy = ly * TILE_SIZE;
				const tileId = chunk.getTerrain(lx, ly);
				const idx = ly * CHUNK_SIZE + lx;
				const grassPacked = chunk.autotileCache[idx] ?? 0;
				const dirtPacked = chunk.dirtAutotileCache[idx] ?? 0;

				if (dirtPacked > 0) {
					// Sand tile: three layers (water → grass autotile → dirt autotile)
					if (waterSheet) {
						waterSheet.drawTile(offCtx, 0, 0, dx, dy, 1);
					}
					if (grassSheet && grassPacked > 0) {
						const grassCol = grassPacked & 0xff;
						const grassRow = grassPacked >> 8;
						grassSheet.drawTile(offCtx, grassCol, grassRow, dx, dy, 1);
					}
					if (dirtSheet) {
						const dirtCol = dirtPacked & 0xff;
						const dirtRow = dirtPacked >> 8;
						dirtSheet.drawTile(offCtx, dirtCol, dirtRow, dx, dy, 1);
					}
				} else if (grassPacked > 0) {
					// Grass autotile: draw water base underneath for transparent edge reveal
					if (waterSheet) {
						waterSheet.drawTile(offCtx, 0, 0, dx, dy, 1);
					}
					if (grassSheet) {
						const col = grassPacked & 0xff;
						const row = grassPacked >> 8;
						grassSheet.drawTile(offCtx, col, row, dx, dy, 1);
					}
				} else {
					// Regular tile from registry (water, etc.)
					const def = getTileDef(tileId);
					if (def) {
						const sheet = sheets.get(def.sheetKey);
						if (sheet) {
							sheet.drawTile(offCtx, def.spriteCol, def.spriteRow, dx, dy, 1);
						}
					}
				}

				// Detail layer on top
				const detailId = chunk.getDetail(lx, ly);
				if (detailId !== TileId.Empty) {
					const def = getTileDef(detailId);
					if (def) {
						const sheet = sheets.get(def.sheetKey);
						if (sheet) {
							sheet.drawTile(offCtx, def.spriteCol, def.spriteRow, dx, dy, 1);
						}
					}
				}
			}
		}
	}
}

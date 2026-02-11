import type { Spritesheet } from "../assets/Spritesheet.js";
import { CHUNK_SIZE, PIXEL_SCALE, TILE_SIZE } from "../config/constants.js";
import type { Chunk } from "../world/Chunk.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import { getTileDef, TileId } from "../world/TileRegistry.js";
import { chunkToWorld } from "../world/types.js";
import type { World } from "../world/World.js";
import type { Camera } from "./Camera.js";

const CHUNK_NATIVE_PX = CHUNK_SIZE * TILE_SIZE;

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
		for (let cy = visible.minCy; cy <= visible.maxCy; cy++) {
			for (let cx = visible.minCx; cx <= visible.maxCx; cx++) {
				const chunk = world.getChunk(cx, cy);
				const origin = chunkToWorld(cx, cy);
				const screenOrigin = camera.worldToScreen(origin.wx, origin.wy);

				const sx = Math.floor(screenOrigin.sx);
				const sy = Math.floor(screenOrigin.sy);

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
					ctx.drawImage(chunk.renderCache, sx, sy, this.chunkScreenSize, this.chunkScreenSize);
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

		for (let ly = 0; ly < CHUNK_SIZE; ly++) {
			for (let lx = 0; lx < CHUNK_SIZE; lx++) {
				const dx = lx * TILE_SIZE;
				const dy = ly * TILE_SIZE;
				const tileId = chunk.getTerrain(lx, ly);
				const packed = chunk.autotileCache[ly * CHUNK_SIZE + lx] ?? 0;

				if (packed > 0) {
					// Grass autotile: draw water base underneath for transparent edge reveal
					if (waterSheet) {
						waterSheet.drawTile(offCtx, 0, 0, dx, dy, 1);
					}
					// Draw the autotile grass sprite on top
					if (grassSheet) {
						const col = packed & 0xff;
						const row = packed >> 8;
						grassSheet.drawTile(offCtx, col, row, dx, dy, 1);
					}
				} else {
					// Regular tile from registry
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

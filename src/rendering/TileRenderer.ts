import type { Spritesheet } from "../assets/Spritesheet.js";
import { CHUNK_SIZE, PIXEL_SCALE, TILE_SIZE } from "../config/constants.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import { getTileDef, type TileId } from "../world/TileRegistry.js";
import { chunkToWorld } from "../world/types.js";
import type { World } from "../world/World.js";
import type { Camera } from "./Camera.js";

/** Brute-force per-tile terrain renderer. No OffscreenCanvas caching yet. */
export class TileRenderer {
	private readonly tileScreen = TILE_SIZE * PIXEL_SCALE;

	drawTerrain(
		ctx: CanvasRenderingContext2D,
		camera: Camera,
		world: World,
		sheet: Spritesheet,
		visible: ChunkRange,
	): void {
		for (let cy = visible.minCy; cy <= visible.maxCy; cy++) {
			for (let cx = visible.minCx; cx <= visible.maxCx; cx++) {
				const chunk = world.getChunk(cx, cy);
				const origin = chunkToWorld(cx, cy);
				const screenOrigin = camera.worldToScreen(origin.wx, origin.wy);

				for (let ly = 0; ly < CHUNK_SIZE; ly++) {
					for (let lx = 0; lx < CHUNK_SIZE; lx++) {
						const tileId: TileId = chunk.getTerrain(lx, ly);
						const def = getTileDef(tileId);
						if (!def) continue;

						const sx = Math.floor(screenOrigin.sx + lx * this.tileScreen);
						const sy = Math.floor(screenOrigin.sy + ly * this.tileScreen);

						// Cull tiles outside viewport
						if (
							sx + this.tileScreen < 0 ||
							sy + this.tileScreen < 0 ||
							sx > ctx.canvas.width ||
							sy > ctx.canvas.height
						) {
							continue;
						}

						sheet.drawTile(ctx, def.spriteCol, def.spriteRow, sx, sy, PIXEL_SCALE);
					}
				}
			}
		}
	}
}

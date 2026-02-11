import { CHUNK_SIZE, PIXEL_SCALE, TILE_SIZE } from "../config/constants.js";
import { getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import type { Camera } from "./Camera.js";

export interface DebugInfo {
	fps: number;
	entityCount: number;
	chunkCount: number;
}

function drawFPS(ctx: CanvasRenderingContext2D, info: DebugInfo): void {
	ctx.save();
	ctx.font = "14px monospace";
	ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
	ctx.fillRect(4, 4, 180, 56);
	ctx.fillStyle = "#00ff00";
	ctx.fillText(`FPS: ${info.fps}`, 10, 20);
	ctx.fillText(`Entities: ${info.entityCount}`, 10, 36);
	ctx.fillText(`Chunks: ${info.chunkCount}`, 10, 52);
	ctx.restore();
}

function drawChunkBorders(
	ctx: CanvasRenderingContext2D,
	camera: Camera,
	visible: { minCx: number; minCy: number; maxCx: number; maxCy: number },
): void {
	ctx.save();
	ctx.strokeStyle = "rgba(255, 255, 0, 0.3)";
	ctx.lineWidth = 1;

	const chunkPx = CHUNK_SIZE * TILE_SIZE;

	for (let cy = visible.minCy; cy <= visible.maxCy + 1; cy++) {
		const wy = cy * chunkPx;
		const left = camera.worldToScreen(visible.minCx * chunkPx, wy);
		const right = camera.worldToScreen((visible.maxCx + 1) * chunkPx, wy);
		ctx.beginPath();
		ctx.moveTo(left.sx, left.sy);
		ctx.lineTo(right.sx, right.sy);
		ctx.stroke();
	}

	for (let cx = visible.minCx; cx <= visible.maxCx + 1; cx++) {
		const wx = cx * chunkPx;
		const top = camera.worldToScreen(wx, visible.minCy * chunkPx);
		const bottom = camera.worldToScreen(wx, (visible.maxCy + 1) * chunkPx);
		ctx.beginPath();
		ctx.moveTo(top.sx, top.sy);
		ctx.lineTo(bottom.sx, bottom.sy);
		ctx.stroke();
	}

	ctx.restore();
}

function drawCollisionBoxes(
	ctx: CanvasRenderingContext2D,
	camera: Camera,
	entities: Entity[],
): void {
	ctx.save();
	ctx.strokeStyle = "rgba(255, 0, 0, 0.7)";
	ctx.lineWidth = 1;

	for (const entity of entities) {
		if (!entity.collider) continue;
		const aabb = getEntityAABB(entity.position, entity.collider);
		const topLeft = camera.worldToScreen(aabb.left, aabb.top);
		const w = (aabb.right - aabb.left) * PIXEL_SCALE;
		const h = (aabb.bottom - aabb.top) * PIXEL_SCALE;
		ctx.strokeRect(Math.floor(topLeft.sx), Math.floor(topLeft.sy), w, h);
	}

	ctx.restore();
}

/** Draw complete debug overlay. */
export function drawDebugOverlay(
	ctx: CanvasRenderingContext2D,
	camera: Camera,
	entities: Entity[],
	info: DebugInfo,
	visible: { minCx: number; minCy: number; maxCx: number; maxCy: number },
): void {
	drawFPS(ctx, info);
	drawChunkBorders(ctx, camera, visible);
	drawCollisionBoxes(ctx, camera, entities);
}

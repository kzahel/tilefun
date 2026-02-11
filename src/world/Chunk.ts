import { CHUNK_SIZE } from "../config/constants.js";
import type { TileId } from "./TileRegistry.js";

const AREA = CHUNK_SIZE * CHUNK_SIZE;

function idx(lx: number, ly: number): number {
	return ly * CHUNK_SIZE + lx;
}

export class Chunk {
	/** Base terrain tile IDs. */
	readonly terrain: Uint16Array;
	/** Decoration tile IDs (0 = empty). */
	readonly detail: Uint16Array;
	/** Resolved spritesheet positions for autotile. */
	readonly autotileCache: Uint16Array;
	/** Collision bitfield per tile. */
	readonly collision: Uint8Array;

	constructor() {
		this.terrain = new Uint16Array(AREA);
		this.detail = new Uint16Array(AREA);
		this.autotileCache = new Uint16Array(AREA);
		this.collision = new Uint8Array(AREA);
	}

	getTerrain(lx: number, ly: number): TileId {
		return this.terrain[idx(lx, ly)] as TileId;
	}

	setTerrain(lx: number, ly: number, id: TileId): void {
		this.terrain[idx(lx, ly)] = id;
	}

	getCollision(lx: number, ly: number): number {
		return this.collision[idx(lx, ly)] as number;
	}

	setCollision(lx: number, ly: number, flags: number): void {
		this.collision[idx(lx, ly)] = flags;
	}

	getDetail(lx: number, ly: number): TileId {
		return this.detail[idx(lx, ly)] as TileId;
	}

	setDetail(lx: number, ly: number, id: TileId): void {
		this.detail[idx(lx, ly)] = id;
	}

	/** Fill entire chunk with a single terrain tile. */
	fillTerrain(id: TileId): void {
		this.terrain.fill(id);
	}

	/** Fill entire chunk collision with a single flag set. */
	fillCollision(flags: number): void {
		this.collision.fill(flags);
	}
}

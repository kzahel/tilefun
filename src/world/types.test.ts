import { describe, expect, it } from "vitest";
import {
	chunkKey,
	chunkToWorld,
	tileToChunk,
	tileToLocal,
	tileToWorld,
	worldToTile,
} from "./types.js";

describe("worldToTile", () => {
	it("converts positive world coords", () => {
		const t = worldToTile(32, 48);
		expect(t.tx).toBe(2);
		expect(t.ty).toBe(3);
	});

	it("floors fractional coords", () => {
		const t = worldToTile(15.9, 31.9);
		expect(t.tx).toBe(0);
		expect(t.ty).toBe(1);
	});

	it("handles negative coords", () => {
		const t = worldToTile(-1, -17);
		expect(t.tx).toBe(-1);
		expect(t.ty).toBe(-2);
	});

	it("handles origin", () => {
		const t = worldToTile(0, 0);
		expect(t.tx).toBe(0);
		expect(t.ty).toBe(0);
	});
});

describe("tileToWorld", () => {
	it("converts tile to top-left world pixel", () => {
		const w = tileToWorld(3, 5);
		expect(w.wx).toBe(48);
		expect(w.wy).toBe(80);
	});

	it("handles negative tiles", () => {
		const w = tileToWorld(-2, -1);
		expect(w.wx).toBe(-32);
		expect(w.wy).toBe(-16);
	});
});

describe("tileToChunk", () => {
	it("converts positive tile to chunk", () => {
		const c = tileToChunk(0, 0);
		expect(c.cx).toBe(0);
		expect(c.cy).toBe(0);
	});

	it("tiles 0-15 map to chunk 0", () => {
		const c = tileToChunk(15, 15);
		expect(c.cx).toBe(0);
		expect(c.cy).toBe(0);
	});

	it("tile 16 maps to chunk 1", () => {
		const c = tileToChunk(16, 32);
		expect(c.cx).toBe(1);
		expect(c.cy).toBe(2);
	});

	it("handles negative tiles", () => {
		const c = tileToChunk(-1, -1);
		expect(c.cx).toBe(-1);
		expect(c.cy).toBe(-1);
	});

	it("tile -16 maps to chunk -1", () => {
		const c = tileToChunk(-16, -16);
		expect(c.cx).toBe(-1);
		expect(c.cy).toBe(-1);
	});

	it("tile -17 maps to chunk -2", () => {
		const c = tileToChunk(-17, -17);
		expect(c.cx).toBe(-2);
		expect(c.cy).toBe(-2);
	});
});

describe("tileToLocal", () => {
	it("converts positive tile to local", () => {
		const l = tileToLocal(3, 7);
		expect(l.lx).toBe(3);
		expect(l.ly).toBe(7);
	});

	it("wraps at chunk boundary", () => {
		const l = tileToLocal(16, 32);
		expect(l.lx).toBe(0);
		expect(l.ly).toBe(0);
	});

	it("handles negative tiles with double-modulo", () => {
		const l = tileToLocal(-1, -1);
		expect(l.lx).toBe(15);
		expect(l.ly).toBe(15);
	});

	it("tile -16 maps to local 0", () => {
		const l = tileToLocal(-16, -16);
		expect(l.lx).toBe(0);
		expect(l.ly).toBe(0);
	});

	it("tile -17 maps to local 15", () => {
		const l = tileToLocal(-17, -17);
		expect(l.lx).toBe(15);
		expect(l.ly).toBe(15);
	});
});

describe("chunkToWorld", () => {
	it("converts chunk (0,0) to world origin", () => {
		const w = chunkToWorld(0, 0);
		expect(w.wx).toBe(0);
		expect(w.wy).toBe(0);
	});

	it("converts chunk (1,2) to correct world pos", () => {
		const w = chunkToWorld(1, 2);
		expect(w.wx).toBe(256);
		expect(w.wy).toBe(512);
	});

	it("handles negative chunks", () => {
		const w = chunkToWorld(-1, -1);
		expect(w.wx).toBe(-256);
		expect(w.wy).toBe(-256);
	});
});

describe("chunkKey", () => {
	it("creates comma-separated key", () => {
		expect(chunkKey(3, -5)).toBe("3,-5");
	});

	it("handles zero", () => {
		expect(chunkKey(0, 0)).toBe("0,0");
	});
});

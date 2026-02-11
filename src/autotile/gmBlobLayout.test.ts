import { describe, expect, it } from "vitest";
import { canonicalize } from "./bitmask.js";
import { GM_BLOB_47, GM_BLOB_LOOKUP, getGmBlobSprite } from "./gmBlobLayout.js";

describe("GM_BLOB_47", () => {
	it("has exactly 47 entries", () => {
		expect(GM_BLOB_47.length).toBe(47);
	});

	it("has 47 unique canonical masks", () => {
		const masks = GM_BLOB_47.map(([m]) => m);
		expect(new Set(masks).size).toBe(47);
	});

	it("every mask is already canonical", () => {
		for (const [mask] of GM_BLOB_47) {
			expect(canonicalize(mask)).toBe(mask);
		}
	});

	it("contains all the same canonical masks as existing autotile", () => {
		const expected = new Set([
			0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 19, 23, 27,
			31, 37, 39, 45, 47, 55, 63, 74, 75, 78, 79, 91, 95, 111, 127, 140,
			141, 142, 143, 159, 173, 175, 191, 206, 207, 223, 239, 255,
		]);
		const actual = new Set(GM_BLOB_47.map(([m]) => m));
		expect(actual).toEqual(expected);
	});

	it("all grid positions are within 12×4 bounds", () => {
		for (const [, col, row] of GM_BLOB_47) {
			expect(col).toBeGreaterThanOrEqual(0);
			expect(col).toBeLessThan(12);
			expect(row).toBeGreaterThanOrEqual(0);
			expect(row).toBeLessThan(4);
		}
	});

	it("all grid positions are unique", () => {
		const positions = GM_BLOB_47.map(([, c, r]) => `${c},${r}`);
		expect(new Set(positions).size).toBe(47);
	});
});

describe("GM_BLOB_LOOKUP", () => {
	it("has 256 entries", () => {
		expect(GM_BLOB_LOOKUP.length).toBe(256);
	});

	it("all entries decode to valid grid positions", () => {
		for (let m = 0; m < 256; m++) {
			const packed = GM_BLOB_LOOKUP[m]!;
			const col = packed & 0xff;
			const row = packed >> 8;
			expect(col).toBeLessThan(12);
			expect(row).toBeLessThan(4);
		}
	});

	it("mask 0 maps to isolated tile at (11, 3)", () => {
		const { col, row } = getGmBlobSprite(0);
		expect(col).toBe(11);
		expect(row).toBe(3);
	});

	it("mask 255 maps to full interior at (1, 0)", () => {
		const { col, row } = getGmBlobSprite(255);
		expect(col).toBe(1);
		expect(row).toBe(0);
	});

	it("mask 1 (N only) maps to (9, 3)", () => {
		const { col, row } = getGmBlobSprite(1);
		expect(col).toBe(9);
		expect(row).toBe(3);
	});

	it("mask 15 (all cardinals, no corners) maps to (4, 1)", () => {
		const { col, row } = getGmBlobSprite(15);
		expect(col).toBe(4);
		expect(row).toBe(1);
	});

	it("non-canonical masks collapse to same position as canonical", () => {
		// mask 17 = N(1) + NW(16) but NW requires both N and W
		// canonicalize(17) = N only = 1
		expect(getGmBlobSprite(17)).toEqual(getGmBlobSprite(1));

		// mask 48 = NE(32) + NW(16) but neither has required cardinals
		// canonicalize(48) = 0 (isolated)
		expect(getGmBlobSprite(48)).toEqual(getGmBlobSprite(0));
	});
});

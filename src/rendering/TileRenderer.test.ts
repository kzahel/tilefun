import { describe, expect, it } from "vitest";
import { getWaterFrame } from "./TileRenderer.js";

describe("getWaterFrame", () => {
	it("returns 0 at time 0", () => {
		expect(getWaterFrame(0)).toBe(0);
	});

	it("returns 0 within the first frame duration", () => {
		expect(getWaterFrame(100)).toBe(0);
		expect(getWaterFrame(249)).toBe(0);
	});

	it("returns 1 at exactly 250ms", () => {
		expect(getWaterFrame(250)).toBe(1);
	});

	it("returns 2 at 500ms", () => {
		expect(getWaterFrame(500)).toBe(2);
	});

	it("returns 3 at 750ms", () => {
		expect(getWaterFrame(750)).toBe(3);
	});

	it("cycles back to 0 at 1000ms", () => {
		expect(getWaterFrame(1000)).toBe(0);
	});

	it("cycles correctly over multiple periods", () => {
		expect(getWaterFrame(2500)).toBe(2);
		expect(getWaterFrame(5750)).toBe(3);
	});
});

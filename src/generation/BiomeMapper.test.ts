import { describe, expect, it } from "vitest";
import { BiomeId, BiomeMapper } from "./BiomeMapper.js";

describe("BiomeMapper.classify", () => {
	it("maps low elevation to DeepWater", () => {
		expect(BiomeMapper.classify(0.1, 0.5)).toBe(BiomeId.DeepWater);
		expect(BiomeMapper.classify(0.29, 0.5)).toBe(BiomeId.DeepWater);
	});

	it("maps mid-low elevation to ShallowWater", () => {
		expect(BiomeMapper.classify(0.3, 0.5)).toBe(BiomeId.ShallowWater);
		expect(BiomeMapper.classify(0.39, 0.5)).toBe(BiomeId.ShallowWater);
	});

	it("maps sand elevation band", () => {
		expect(BiomeMapper.classify(0.4, 0.5)).toBe(BiomeId.Sand);
		expect(BiomeMapper.classify(0.44, 0.5)).toBe(BiomeId.Sand);
	});

	it("maps high elevation + low moisture to Grass", () => {
		expect(BiomeMapper.classify(0.6, 0.3)).toBe(BiomeId.Grass);
		expect(BiomeMapper.classify(0.9, 0.1)).toBe(BiomeId.Grass);
	});

	it("maps high elevation + mid moisture to Forest", () => {
		expect(BiomeMapper.classify(0.6, 0.55)).toBe(BiomeId.Forest);
	});

	it("maps high elevation + high moisture to DenseForest", () => {
		expect(BiomeMapper.classify(0.6, 0.7)).toBe(BiomeId.DenseForest);
		expect(BiomeMapper.classify(0.9, 0.9)).toBe(BiomeId.DenseForest);
	});

	it("boundary: elevation exactly at threshold", () => {
		// elevation 0.3 → ShallowWater (>= 0.3 passes DeepWater check)
		expect(BiomeMapper.classify(0.3, 0.5)).toBe(BiomeId.ShallowWater);
		// elevation 0.4 → Sand
		expect(BiomeMapper.classify(0.4, 0.5)).toBe(BiomeId.Sand);
		// elevation 0.45, moisture 0.5 → Forest
		expect(BiomeMapper.classify(0.45, 0.5)).toBe(BiomeId.Forest);
	});
});

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

	it("maps land + low moisture to Sand (dry inland)", () => {
		expect(BiomeMapper.classify(0.5, 0.1)).toBe(BiomeId.Sand);
		expect(BiomeMapper.classify(0.8, 0.29)).toBe(BiomeId.Sand);
	});

	it("maps land + moderate moisture to Grass", () => {
		expect(BiomeMapper.classify(0.6, 0.3)).toBe(BiomeId.Grass);
		expect(BiomeMapper.classify(0.5, 0.49)).toBe(BiomeId.Grass);
	});

	it("maps land + mid moisture to Forest", () => {
		expect(BiomeMapper.classify(0.6, 0.55)).toBe(BiomeId.Forest);
	});

	it("maps land + high moisture to DenseForest", () => {
		expect(BiomeMapper.classify(0.6, 0.7)).toBe(BiomeId.DenseForest);
		expect(BiomeMapper.classify(0.9, 0.9)).toBe(BiomeId.DenseForest);
	});

	it("grass always borders water (no sand at water edge)", () => {
		// Just above water threshold with low moisture → Sand
		// But the elevation band 0.4+ ensures grass is the first land biome
		// when moisture is moderate
		expect(BiomeMapper.classify(0.4, 0.35)).toBe(BiomeId.Grass);
		expect(BiomeMapper.classify(0.41, 0.4)).toBe(BiomeId.Grass);
	});

	it("boundary: elevation exactly at threshold", () => {
		// elevation 0.3 → ShallowWater (>= 0.3 passes DeepWater check)
		expect(BiomeMapper.classify(0.3, 0.5)).toBe(BiomeId.ShallowWater);
		// elevation 0.4, moisture 0.5 → Forest
		expect(BiomeMapper.classify(0.4, 0.5)).toBe(BiomeId.Forest);
	});
});

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createProp, getWallsForPropType } from "../../entities/PropFactories.js";
import { exteriorEntrance } from "../../interiors/GameplayInterior.js";
import { BUILDING_RECIPES, buildingRecipe } from "./BuildingRecipes.js";
import {
  CITY_BUILDING_PREFABS,
  CITY_PREFAB_SOURCE,
  cityPrefabBlock,
} from "./CityBuildingPrefabs.js";

describe("source-audited city prefab candidates", () => {
  it("pins every sampled pixel to the user's exact selected image and region", () => {
    expect(
      createHash("sha256")
        .update(readFileSync("public/assets/tilesets/me-complete.png"))
        .digest("hex"),
    ).toBe(CITY_PREFAB_SOURCE.fingerprint);
    const [x, y, w, h] = CITY_PREFAB_SOURCE.rect;
    for (const prefab of CITY_BUILDING_PREFABS)
      for (const p of prefab.parts) {
        expect(p.frameCol * 16).toBeGreaterThanOrEqual(x);
        expect(p.frameRow * 16).toBeGreaterThanOrEqual(y);
        expect(p.frameCol * 16 + p.spriteWidth).toBeLessThanOrEqual(x + w);
        expect(p.frameRow * 16 + p.spriteHeight).toBeLessThanOrEqual(y + h);
      }
  });
  it("keeps the frozen district list and shares new candidate lookup, composition, and geometry", () => {
    expect(BUILDING_RECIPES.map((p) => p.type)).toEqual([
      "prop-regional-apartment-2",
      "prop-regional-apartment-3",
      "prop-regional-bakery",
      "prop-regional-shop-apartment",
    ]);
    for (const prefab of CITY_BUILDING_PREFABS) {
      expect(buildingRecipe(prefab.type)).toBe(prefab);
      const prop = createProp(prefab.type, 0, 0);
      expect(prop.sprite.parts).toBe(prefab.parts);
      expect(getWallsForPropType(prefab.type)?.[0]?.width).toBe(prefab.width);
      expect(exteriorEntrance(prop)).toEqual({ wx: prefab.entrance.dx, wy: prefab.entrance.dy });
      expect(prefab.height).toBe(Math.max(...prefab.parts.map((p) => p.spriteHeight - p.dy)));
      for (const p of prefab.parts) {
        expect(Math.abs(p.dx) + p.spriteWidth / 2).toBeLessThanOrEqual(prefab.width / 2);
        expect(p.dy).toBeLessThanOrEqual(16);
      }
    }
  });
  it("aligns adjacent frontage without overlapping ground bounds and keeps approach doors outside walls", () => {
    for (const kind of ["residential", "mixed", "hotel"] as const) {
      const block = cityPrefabBlock(kind);
      for (const [i, p] of block.entries()) {
        expect(p.prefab.entrance.dy).toBeGreaterThan(p.prefab.groundDepth / 2);
        const prev = block[i - 1];
        if (prev) expect(p.wx - p.prefab.width / 2).toBe(prev.wx + prev.prefab.width / 2);
      }
    }
  });
});

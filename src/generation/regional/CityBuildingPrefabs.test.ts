import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getEntityAABB } from "../../entities/collision.js";
import { createProp, getWallsForPropType } from "../../entities/PropFactories.js";
import { exteriorEntrance } from "../../interiors/GameplayInterior.js";
import {
  BUILDING_RECIPES,
  buildingBody,
  buildingRecipe,
  buildingVisualBounds,
} from "./BuildingRecipes.js";
import { CITY_ARCHITECTURE_BUILDINGS } from "./CityArchitectureAssets.js";
import {
  CITY_BUILDING_PREFABS,
  CITY_COMMERCIAL_ENVELOPE,
  CITY_HOTEL_ART,
  CITY_PREFAB_SOURCE,
  CONDO_FACADE_MODULES,
  cityPrefabBlock,
  resolveCityPrefabType,
  validateFacadeTopology,
  validateStorefrontEnvelope,
} from "./CityBuildingPrefabs.js";
import { DENSE_CITY_BUILDINGS } from "./DenseCityAssets.js";
import { SHOPPING_BUILDINGS } from "./ShoppingScenery.js";

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Missing value");
  return value;
}

describe("source-audited city prefab candidates", () => {
  it("pins sampled pixels to the selected image and explicitly audited source regions", () => {
    expect(
      createHash("sha256")
        .update(readFileSync("public/assets/tilesets/me-complete.png"))
        .digest("hex"),
    ).toBe(CITY_PREFAB_SOURCE.fingerprint);
    const regions = [
      CITY_PREFAB_SOURCE.rect,
      CITY_COMMERCIAL_ENVELOPE.roof,
      CITY_COMMERCIAL_ENVELOPE.floor,
      ...Object.values(CITY_HOTEL_ART),
    ];
    for (const prefab of CITY_BUILDING_PREFABS)
      for (const p of prefab.parts) {
        expect(
          regions.some(
            ([x, y, w, h]) =>
              p.frameCol * 16 >= x &&
              p.frameRow * 16 >= y &&
              p.frameCol * 16 + p.spriteWidth <= x + w &&
              p.frameRow * 16 + p.spriteHeight <= y + h,
          ),
        ).toBe(true);
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
      expect(exteriorEntrance(prop)).toEqual({ wx: prefab.entrance.dx, wy: prefab.entrance.dy });
      expect(prefab.height).toBe(Math.max(...prefab.parts.map((p) => p.spriteHeight - p.dy)));
      const bounds = buildingVisualBounds(prefab);
      for (const p of prefab.parts) {
        expect(Math.abs(p.dx) + p.spriteWidth / 2).toBeLessThanOrEqual(prop.sprite.spriteWidth / 2);
        expect(p.dy).toBeLessThanOrEqual(16);
      }
      expect(bounds.minY).toBe(-prefab.height);
    }
  });
  it("fits the compound exterior to the painted frontage, deck depth and cornice", () => {
    for (const recipe of [
      ...BUILDING_RECIPES,
      ...CITY_BUILDING_PREFABS,
      ...DENSE_CITY_BUILDINGS,
      ...CITY_ARCHITECTURE_BUILDINGS,
    ]) {
      const body = buildingBody(recipe);
      const walls = required(getWallsForPropType(recipe.type) ?? undefined);
      const bounds = walls.map((c) => getEntityAABB({ wx: 0, wy: 0 }, c));
      expect(Math.min(...bounds.map((b) => b.left))).toBe(-recipe.width / 2);
      expect(Math.max(...bounds.map((b) => b.right))).toBe(recipe.width / 2);
      expect(Math.min(...bounds.map((b) => b.top))).toBe(-body.depth);
      expect(Math.max(...bounds.map((b) => b.bottom))).toBe(0);
      expect(Math.max(...walls.map((c) => (c.zBase ?? 0) + (c.zHeight ?? 0)))).toBe(body.height);
      // From above the box covers the picture's rows; only a rooftop sign stands clear.
      const sign = recipe.type.endsWith("-roof-sign") ? 40 : 0;
      expect(body.depth + body.height, recipe.type).toBe(recipe.height - sign);
      expect(body.depth, recipe.type).toBeGreaterThanOrEqual(96);
      expect(body.height, recipe.type).toBeGreaterThanOrEqual(48);
    }
    for (const prefab of CITY_BUILDING_PREFABS)
      expect(buildingBody(prefab).depth).toBe(
        prefab.family === "hotel" ? 112 : prefab.topology.roof.depth,
      );
    // A promoted copy takes the deck its source prefab declares.
    expect(buildingBody(required(buildingRecipe("prop-city-dense-v1-hotel-4-roof-sign")))).toEqual({
      depth: 112,
      height: 256,
    });
    // A storefront strip's picture is all wall: its roof is a separate ground piece.
    for (const shop of SHOPPING_BUILDINGS)
      expect(buildingBody(shop)).toEqual({ depth: 16, height: 64 });
  });
  it("restores the full hotel roof and keeps optional signage out of the ground footprint", () => {
    const hotels = CITY_BUILDING_PREFABS.filter((p) => p.family === "hotel");
    expect(hotels).toHaveLength(9);
    for (const p of hotels) {
      expect(p.parts.some((s) => s.frameRow * 16 === 1824 && s.spriteHeight === 32)).toBe(true);
      expect(p.parts.filter((s) => s.frameRow * 16 === 1808)).toHaveLength(0);
      const signs = p.parts.filter((s) => s.frameRow * 16 === 1744 || s.frameCol * 16 === 2192);
      expect(signs).toHaveLength(p.hotelSign === "none" ? 0 : 1);
      const bounds = buildingVisualBounds(p);
      expect(bounds.maxX).toBe(p.hotelSign === "side" ? 184 : 136);
      expect(p.width).toBe(272);
      expect(p.groundDepth).toBe(32);
      expect(p.entrance).toEqual({ dx: 0, dy: 24 });
      expect(p.height).toBe(304 + (p.floors - 3) * 64 + (p.hotelSign === "roof" ? 40 : 0));
      expect(getWallsForPropType(p.type)?.[0]?.width).toBe(272);
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
  it("requires closed outer ends, matching sockets, and compatible roof bands", () => {
    const { bay, infill, entrance } = CONDO_FACADE_MODULES;
    expect(() => validateFacadeTopology([bay, infill, entrance])).not.toThrow();
    for (const invalid of [
      [],
      [bay],
      [entrance],
      [infill, entrance],
      [bay, infill],
      [bay, entrance, infill, entrance],
      [bay, { ...infill, roof: [1232, 1904, 64, 128] as const }, entrance],
    ])
      expect(() => validateFacadeTopology(invalid)).toThrow();
    for (const prefab of CITY_BUILDING_PREFABS) {
      const modules = prefab.topology.modules;
      expect(modules[0]?.left).toBe("closed");
      expect(modules.at(-1)?.right).toBe("closed");
      expect(modules.reduce((sum, m) => sum + m.width, 0)).toBe(prefab.width);
      for (const [i, m] of modules.entries()) {
        const previous = modules[i - 1];
        if (previous) {
          expect(previous.x + previous.width).toBe(m.x);
          expect(previous.right).toBe(m.left);
          expect(m.left).not.toBe("closed");
        }
      }
      for (const roof of prefab.topology.roof.parts) {
        expect(roof.dy).toBe(prefab.topology.roof.datum);
        expect(roof.spriteHeight).toBe(prefab.topology.roof.depth);
      }
    }
  });
  it("fits each storefront once into a complete building and retires bare storefront links", () => {
    for (const prefab of CITY_BUILDING_PREFABS.filter((p) => p.family === "storefront")) {
      expect(prefab.floors).toBeGreaterThanOrEqual(2);
      const store = prefab.parts.filter((p) => p.frameRow * 16 === 2384);
      expect(store).toHaveLength(1);
      expect(store[0]?.spriteWidth).toBe(112);
      expect(prefab.parts.some((p) => p.frameRow * 16 === 2416)).toBe(false);
      expect(prefab.profile).toBe("flat-front");
      expect(prefab.parts).toHaveLength(prefab.floors + 1);
      expect(prefab.parts.every((p) => p.dx === 0 && p.spriteWidth === store[0]?.spriteWidth)).toBe(
        true,
      );
      expect(prefab.topology.modules.map((m) => m.id)).toEqual(["modular-commercial"]);
    }
    expect(resolveCityPrefabType("prop-city-v1-bakery-1")).toBe("prop-city-v1-bakery-2");
    expect(resolveCityPrefabType("prop-city-v1-ice-cream-1")).toBe("prop-city-v1-ice-cream-2");
  });
  it("rejects projecting facades, mismatched widths, and wrong ground datums for shops", () => {
    const store = [1120, 2384, 112, 80] as const;
    expect(() => validateStorefrontEnvelope(CITY_COMMERCIAL_ENVELOPE, store)).not.toThrow();
    for (const e of [
      { ...CITY_COMMERCIAL_ENVELOPE, profile: "bay-front" as const },
      { ...CITY_COMMERCIAL_ENVELOPE, family: "condo-4" },
      { ...CITY_COMMERCIAL_ENVELOPE, roof: [2256, 1936, 144, 96] as const },
      { ...CITY_COMMERCIAL_ENVELOPE, floor: [2544, 1984, 80, 64] as const },
      { ...CITY_COMMERCIAL_ENVELOPE, groundHeight: 80 },
    ])
      expect(() => validateStorefrontEnvelope(e, store)).toThrow("matching flat commercial");
  });
});

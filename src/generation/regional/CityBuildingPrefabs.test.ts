import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createProp, getWallsForPropType } from "../../entities/PropFactories.js";
import { exteriorEntrance } from "../../interiors/GameplayInterior.js";
import { BUILDING_RECIPES, buildingRecipe, buildingVisualBounds } from "./BuildingRecipes.js";
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
      expect(getWallsForPropType(prefab.type)?.[0]?.width).toBe(prefab.width);
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
  it("restores the full hotel roof and keeps optional signage out of the ground footprint", () => {
    const hotels = CITY_BUILDING_PREFABS.filter((p) => p.family === "hotel");
    expect(hotels).toHaveLength(9);
    for (const p of hotels) {
      expect(p.parts.some((s) => s.frameRow * 16 === 1824 && s.spriteHeight === 32)).toBe(true);
      expect(p.parts.filter((s) => s.frameRow * 16 === 1808)).toHaveLength(2);
      const signs = p.parts.filter((s) => s.frameRow * 16 === 1744 || s.frameCol * 16 === 2192);
      expect(signs).toHaveLength(p.hotelSign === "none" ? 0 : 1);
      const bounds = buildingVisualBounds(p);
      expect(bounds.maxX).toBe(p.hotelSign === "side" ? 184 : 136);
      expect(p.width).toBe(272);
      expect(p.groundDepth).toBe(32);
      expect(p.entrance).toEqual({ dx: 0, dy: 24 });
      expect(p.height).toBe(320 + (p.floors - 3) * 64 + (p.hotelSign === "roof" ? 24 : 0));
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

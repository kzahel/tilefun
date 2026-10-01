import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createProp, getMaterialForPropType, PROP_PALETTE } from "../../entities/PropFactories.js";
import { CITY_BUILDING_PREFABS } from "./CityBuildingPrefabs.js";
import { STREET_PROP_RECIPES, STREET_REVIEW_SCENES, type StreetRect } from "./StreetRecipes.js";

const overlaps = (a: StreetRect, b: StreetRect) =>
  a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
describe("street starter source and placement contracts", () => {
  it("uses exact indexed slices through normal gameplay/editor factories", () => {
    const index = JSON.parse(readFileSync("public/data/me-atlas-index.json", "utf8")) as {
      themes: Record<string, Record<string, number[]>>;
    };
    for (const r of STREET_PROP_RECIPES) {
      expect(
        Object.values(index.themes).some(
          (t) => JSON.stringify(t[r.sourceName]) === JSON.stringify(r.rect),
        ),
      ).toBe(true);
      const p = createProp(r.type, 123, 456);
      expect(p.position).toEqual({ wx: 123, wy: 456 });
      expect([
        p.sprite.frameCol * 16,
        p.sprite.frameRow * 16,
        p.sprite.spriteWidth,
        p.sprite.spriteHeight,
      ]).toEqual(r.rect);
      expect(p.collider).toEqual(r.collider);
      expect(p.collider).not.toBe(r.collider);
      expect(getMaterialForPropType(r.type)).toBe(r.material);
      expect(PROP_PALETTE.some((p) => p.type === r.type)).toBe(true);
    }
  });
  it("keeps the walking strip, door approach, parking bays and furniture collision separate", () => {
    for (const s of STREET_REVIEW_SCENES) {
      const b = CITY_BUILDING_PREFABS.find((p) => p.type === s.buildingType);
      expect(b).toBeDefined();
      expect(
        (b?.entrance.dx ?? 0) > s.approach.minX && (b?.entrance.dx ?? 0) < s.approach.maxX,
      ).toBe(true);
      expect(s.walkway.maxY - s.walkway.minY).toBeGreaterThanOrEqual(40);
      const bounds: StreetRect[] = [];
      for (const p of s.props) {
        const c = createProp(p.type, p.wx, p.wy).collider;
        if (!c) throw new Error("Missing street collider");
        const r = {
          minX: p.wx + c.offsetX - c.width / 2,
          maxX: p.wx + c.offsetX + c.width / 2,
          minY: p.wy + c.offsetY - c.height / 2,
          maxY: p.wy + c.offsetY + c.height / 2,
        };
        expect(overlaps(r, s.walkway)).toBe(false);
        expect(overlaps(r, s.approach)).toBe(false);
        expect(bounds.some((previous) => overlaps(previous, r))).toBe(false);
        bounds.push(r);
        if (p.type.includes("-car-"))
          expect(
            s.parking.some(
              (b) => r.minX >= b.minX && r.maxX <= b.maxX && r.minY >= b.minY && r.maxY <= b.maxY,
            ),
          ).toBe(true);
        else expect(r.minY >= 64 && r.maxY <= 88).toBe(true);
      }
    }
  });
});

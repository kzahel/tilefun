import { expect, it } from "vitest";
import { TerrainId } from "../autotile/TerrainId.js";
import type { NaturalLandscape } from "../generation/regional/NaturalLandscape.js";
import { faunaType } from "./Fauna.js";
import { foragePlacements } from "./ForagePlacements.js";

const nature = {
  terrain: () => TerrainId.Grass,
  inThicket: () => false,
} as unknown as NaturalLandscape;
it.each(["capuchin-monkey", "red-squirrel"] as const)(
  "%s crops are born in their requested cell and within binding reach of their real tree",
  (species) => {
    for (const [cx, cy] of [
      [0, 0],
      [-2, -1],
      [2, 3],
    ]) {
      for (const [dx, dy] of [
        [1, 1],
        [254, 1],
        [1, 254],
        [254, 254],
      ]) {
        const wx = (cx ?? 0) * 256 + (dx ?? 0),
          wy = (cy ?? 0) * 256 + (dy ?? 0);
        const actor = {
          type: faunaType(species),
          featureId: `wildlife:${species}:boundary`,
          wx: wx ?? 0,
          wy: wy ?? 0,
          route: [],
        };
        const items = foragePlacements([actor], nature, cx ?? 0, cy ?? 0);
        expect(items.length).toBeGreaterThan(0);
        for (const item of items) {
          expect(Math.floor(item.wx / 256)).toBe(cx);
          expect(Math.floor(item.wy / 256)).toBe(cy);
        }
        const crop = items.find((e) => e.type.includes("-tree-"));
        expect(crop).toBeDefined();
        expect(
          Math.hypot((crop?.wx ?? Infinity) - actor.wx, (crop?.wy ?? Infinity) - (actor.wy - 52)),
        ).toBeLessThan(64);
      }
    }
  },
);

it.each(["goat", "piglet", "elephant"] as const)(
  "%s supplies stay in their owning cell near every boundary",
  (species) => {
    for (const [cx, cy] of [
      [0, 0],
      [-2, -1],
      [2, 3],
    ])
      for (const [dx, dy] of [
        [1, 1],
        [254, 1],
        [1, 254],
        [254, 254],
      ]) {
        const actor = {
          type: faunaType(species),
          featureId: `wildlife:${species}:boundary`,
          wx: (cx ?? 0) * 256 + (dx ?? 0),
          wy: (cy ?? 0) * 256 + (dy ?? 0),
          route: [],
        };
        const items = foragePlacements([actor], nature, cx ?? 0, cy ?? 0);
        expect(items).toHaveLength(1);
        for (const item of items) {
          expect(Math.floor(item.wx / 256)).toBe(cx);
          expect(Math.floor(item.wy / 256)).toBe(cy);
          expect(Math.hypot(item.wx - actor.wx, item.wy - actor.wy)).toBeGreaterThan(
            species === "elephant" ? 60 : 12,
          );
        }
      }
  },
);

it.each(["chicken", "bee", "ruby-throated-hummingbird"] as const)(
  "%s shared garden supplies stay bounded and cell-owned at negative and positive seams",
  (species) => {
    for (const [cx, cy] of [
      [0, 0],
      [-2, -1],
      [2, 3],
    ])
      for (const [dx, dy] of [
        [1, 1],
        [254, 1],
        [1, 254],
        [254, 254],
      ]) {
        const actor = {
          type: faunaType(species),
          featureId: `wildlife:${species}:edge`,
          wx: (cx ?? 0) * 256 + (dx ?? 0),
          wy: (cy ?? 0) * 256 + (dy ?? 0),
          route: [],
        };
        const items = foragePlacements(
          [actor, { ...actor, featureId: actor.featureId + ":peer" }],
          nature,
          cx ?? 0,
          cy ?? 0,
        );
        expect(items).toHaveLength(species === "chicken" ? 1 : 3);
        expect(new Set(items.map((e) => e.featureId)).size).toBe(items.length);
        for (const item of items) {
          expect(Math.floor(item.wx / 256)).toBe(cx);
          expect(Math.floor(item.wy / 256)).toBe(cy);
        }
      }
  },
);

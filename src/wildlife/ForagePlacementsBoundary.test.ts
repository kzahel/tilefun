import { expect, it } from "vitest";
import { TerrainId } from "../autotile/TerrainId.js";
import type { NaturalLandscape } from "../generation/regional/NaturalLandscape.js";
import { DEER_TYPE } from "./Deer.js";
import { faunaType } from "./Fauna.js";
import { foragePlacements } from "./ForagePlacements.js";
import { forestSupplies } from "./ForestHabitat.js";
import { foxPrey } from "./ThreatHabitat.js";

const nature = {
  terrain: () => TerrainId.Grass,
  inThicket: () => false,
} as unknown as NaturalLandscape;
it.each([DEER_TYPE, faunaType("raven")])(
  "%s forest supplies are bounded, cell-owned and independent of actor query order",
  (type) => {
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
        const a = {
          type,
          featureId: `forest:${type}:a`,
          wx: (cx ?? 0) * 256 + (dx ?? 0),
          wy: (cy ?? 0) * 256 + (dy ?? 0),
          route: [],
        };
        const b = { ...a, featureId: `forest:${type}:b`, wx: a.wx + 1 };
        const first = forestSupplies([a, b], nature, cx ?? 0, cy ?? 0);
        expect(first).toEqual(forestSupplies([b, a], nature, cx ?? 0, cy ?? 0));
        expect(first).toHaveLength(type === DEER_TYPE ? 1 : 3);
        expect(new Set(first.map((e) => e.featureId)).size).toBe(first.length);
        for (const item of first) {
          expect(Math.floor(item.wx / 256)).toBe(cx);
          expect(Math.floor(item.wy / 256)).toBe(cy);
          expect(item.featureId.startsWith(a.featureId)).toBe(true);
        }
        expect(
          forestSupplies(
            [a],
            { ...nature, terrain: () => TerrainId.ShallowWater } as unknown as NaturalLandscape,
            cx ?? 0,
            cy ?? 0,
          ),
        ).toEqual([]);
      }
  },
);
it.each(["horse", "giraffe", "beaver", "cow", "donkey"] as const)(
  "%s supplies share stable owners within both sides of chunk seams",
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
          [actor, { ...actor, featureId: `${actor.featureId}:peer` }],
          nature,
          cx ?? 0,
          cy ?? 0,
        );
        expect(items).toHaveLength(species === "horse" ? 2 : species === "beaver" ? 3 : 1);
        expect(new Set(items.map((e) => e.featureId)).size).toBe(items.length);
        for (const item of items) {
          expect(Math.floor(item.wx / 256)).toBe(cx);
          expect(Math.floor(item.wy / 256)).toBe(cy);
        }
        if (species === "giraffe")
          expect(
            Math.hypot((items[0]?.wx ?? 0) - actor.wx, (items[0]?.wy ?? 0) - actor.wy),
          ).toBeGreaterThanOrEqual(64);
      }
  },
);
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

it("natural fox prey is bounded, query-order stable, finite and excludes unsafe ground", () => {
  for (const [cx = 0, cy = 0] of [
    [0, 0],
    [-2, -1],
    [2, 3],
  ])
    for (const [dx = 0, dy = 0] of [
      [1, 1],
      [254, 1],
      [1, 254],
      [254, 254],
    ]) {
      const a = {
        type: faunaType("fox"),
        featureId: "fox:a",
        wx: cx * 256 + dx,
        wy: cy * 256 + dy,
        route: [],
      };
      const b = { ...a, featureId: "fox:b" };
      const mice = foxPrey([a, b], nature, cx, cy);
      expect(mice).toEqual(foxPrey([b, a], nature, cx, cy));
      expect(mice).toHaveLength(1);
      expect(Math.floor(requiredMouse(mice).wx / 256)).toBe(cx);
      expect(Math.floor(requiredMouse(mice).wy / 256)).toBe(cy);
      expect(mice[0]?.featureId).toBe("fox:a:hunt-mouse");
      expect(
        foxPrey(
          [a],
          { ...nature, terrain: () => TerrainId.ShallowWater } as unknown as NaturalLandscape,
          cx,
          cy,
        ),
      ).toEqual([]);
      expect(
        foxPrey([a], { ...nature, inThicket: () => true } as unknown as NaturalLandscape, cx, cy),
      ).toEqual([]);
    }
  expect(foxPrey([], nature, 0, 0)).toEqual([]);
});
function requiredMouse<T>(a: T[]): T {
  if (!a[0]) throw Error("missing mouse");
  return a[0];
}

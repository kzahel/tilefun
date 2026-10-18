import { expect, it } from "vitest";
import { required } from "../../art/ArtCatalog.js";
import { createProp, isPropType } from "../../entities/PropFactories.js";
import { isCityRoad } from "../../road/DenseCitySurface.js";
import { isParkingSurface } from "../../road/ParkingSurface.js";
import { buildLaneGraph, generatedSegments } from "../../traffic/LaneGraph.js";
import { shoppingLot } from "../../traffic/ShoppingCenter.js";
import { DenseDistrictSource, denseSurfaceAt } from "./DenseDistrictPlanner.js";
import { settlementForOwner } from "./RegionalPlanner.js";
import { shoppingScenery } from "./ShoppingScenery.js";
import { regionalWorld } from "./WorldDescriptor.js";

it("gives every current city one or two road-connected centers without extending grid streets into the lots", () => {
  let cities = 0,
    large = 0,
    villages = 0;
  for (const seed of [2026, 42, 7]) {
    const world = regionalWorld(seed),
      source = new DenseDistrictSource(world, true);
    for (let y = -2; y <= 2; y++)
      for (let x = -2; x <= 2; x++) {
        const settlement = settlementForOwner(world, x, y),
          plan = source.owner(x, y);
        if (!settlement || !plan) continue;
        if (settlement.kind === "village") {
          villages++;
          expect(plan.shoppingCenters).toBeUndefined();
          continue;
        }
        cities++;
        const columns = plan.streets.filter((s) => s.points[0]?.x === s.points[1]?.x).length - 1;
        expect(plan.shoppingCenters).toHaveLength(columns === 6 ? 2 : 1);
        if (columns === 6) large++;
        const graph = buildLaneGraph(generatedSegments([plan], []));
        for (const c of plan.shoppingCenters ?? []) {
          const lot = shoppingLot(c, "compact-1"),
            visit = required(lot.visits[0]);
          expect(lot.bounds.top / 16).toBe(plan.bounds.minY);
          for (const route of [visit.arrival, visit.departure])
            for (let i = 1; i < route.length; i++) {
              const a = required(route[i - 1]),
                b = required(route[i]);
              const length = Math.hypot(a.wx - b.wx, a.wy - b.wy);
              for (let d = 0; d <= length; d += 8) {
                const px = a.wx + ((b.wx - a.wx) * d) / length,
                  py = a.wy + ((b.wy - a.wy) * d) / length;
                expect(
                  isCityRoad(denseSurfaceAt(plan, Math.floor(px / 16), Math.floor(py / 16))),
                ).toBe(true);
              }
            }
          const entry = required(visit.arrival[0]);
          expect(
            [...graph.lanes.values()].some(
              (l) =>
                l.path.points.every((p) => p.y === entry.wy) &&
                Math.min(...l.path.points.map((p) => p.x)) <= entry.wx &&
                Math.max(...l.path.points.map((p) => p.x)) >= entry.wx,
            ),
          ).toBe(true);
          expect(
            [...graph.lanes.values()].every((l) => l.path.points.every((p) => p.y >= c.roadY - 64)),
          ).toBe(true);
          expect(
            isParkingSurface(
              denseSurfaceAt(plan, Math.floor((c.wx + 104) / 16), Math.floor((c.wy + 128) / 16)),
            ),
          ).toBe(true);
        }
        expect(source.owner(x, y)).toEqual(plan);
      }
  }
  expect(cities).toBeGreaterThan(5);
  expect(large).toBeGreaterThan(0);
  expect(villages).toBeGreaterThan(0);
});
it("reconstructs each generated shopping prop through the durable prop factory", () => {
  for (const p of shoppingScenery) {
    expect(isPropType(p.type)).toBe(true);
    const copy = createProp(p.type, p.position.wx + 1024, p.position.wy - 2048);
    expect(copy.sprite).toEqual(p.sprite);
    expect(copy.sortOffsetY).toBe(p.sortOffsetY);
    expect(copy.position).toEqual({ wx: p.position.wx + 1024, wy: p.position.wy - 2048 });
  }
});

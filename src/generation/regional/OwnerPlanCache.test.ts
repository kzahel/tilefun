import { expect, it } from "vitest";
import { required } from "../../shared/required.js";
import { OwnerPlanCache } from "./OwnerPlanCache.js";
import {
  connectionForOwner,
  QUERY_LIMITS,
  queryRegion,
  settlementForOwner,
} from "./RegionalPlanner.js";
import { regionalWorld } from "./WorldDescriptor.js";

it("bounds owner working memory, retains nulls, isolates worlds/seeds and signed zero", () => {
  let builds = 0;
  const cache = new OwnerPlanCache((world, cx, cy) => {
    builds++;
    return cx === 7 ? null : { seed: world.seed, cx, cy };
  }, 2);
  const world = regionalWorld(2026);
  const first = cache.get(world, 0, 0);
  expect(cache.get(world, 0, 0)).toBe(first);
  expect(cache.get(world, 7, 0)).toBeNull();
  expect(cache.get(world, 7, 0)).toBeNull();
  expect(cache.get(world, 0, 0)).toBe(first);
  expect(builds).toBe(2);
  cache.get(world, -2, -3);
  expect(cache.get(world, 0, 0)).not.toBe(first);
  expect(cache.get(world, -0, 0)?.cx).toBe(-0);
  expect(cache.get(world, 0, 0)?.cx).toBe(0);
  expect(cache.get(regionalWorld(2026), 0, 0)).not.toBe(cache.get(world, 0, 0));
  (world as { seed: number }).seed = 42;
  expect(cache.get(world, 0, 0)?.seed).toBe(42);
});

it("public settlement/connection/query mutations cannot poison later plans", () => {
  const world = regionalWorld(2026);
  const request = {
    bounds: { minX: -2048, minY: -2048, maxX: 2048, maxY: 2048 },
    detail: "region" as const,
    sampleStep: 64,
    limits: QUERY_LIMITS,
  };
  const initial = queryRegion(world, request),
    saved = structuredClone(initial);
  const settlement = required(initial.settlements[0]),
    connection = required(initial.connections[0]);
  const originalSettlement = structuredClone(settlement),
    originalConnection = structuredClone(connection);
  settlement.center.x += 500;
  settlement.bounds.minX -= 500;
  required(settlement.outline[0]).x += 200;
  connection.points[0] = { x: 999, y: 999 };
  connection.settlementIds[0] = "changed";
  connection.bounds.maxX += 123;
  expect(queryRegion(world, request)).toEqual(saved);
  const s = required(
    settlementForOwner(world, originalSettlement.owner.cx, originalSettlement.owner.cy),
  );
  s.owner.cx += 1;
  s.name = "changed";
  s.center.y -= 100;
  expect(
    settlementForOwner(world, originalSettlement.owner.cx, originalSettlement.owner.cy),
  ).toEqual(originalSettlement);
  const axis = originalConnection.id.endsWith(":east") ? "east" : "south";
  const c = required(
    connectionForOwner(world, originalConnection.owner.cx, originalConnection.owner.cy, axis),
  );
  required(c.points[0]).x -= 100;
  c.owner.cy += 1;
  expect(
    connectionForOwner(world, originalConnection.owner.cx, originalConnection.owner.cy, axis),
  ).toEqual(originalConnection);
});

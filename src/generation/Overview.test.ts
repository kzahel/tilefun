import { expect, it, vi } from "vitest";
import { RailwayPlanner } from "../railway/RailwayPlanner.js";
import { createDescriptor } from "./GenerationDescriptor.js";
import { type OverviewResult, overviewSteps } from "./Overview.js";
import { QUERY_LIMITS, type RegionalRequest } from "./regional/RegionalPlanner.js";
import { regionalWorld } from "./regional/WorldDescriptor.js";

function overview(seed: number, request: RegionalRequest): OverviewResult {
  const query = overviewSteps(createDescriptor("regional", seed), request);
  let step = query.next();
  while (!step.done) step = query.next();
  return step.value;
}
it.each([
  [2026, 2, -3],
  [100, -2, -1],
])("maps the production route and both named stops (seed %i)", (seed, cx, cy) => {
  const planner = new RailwayPlanner(regionalWorld(seed)),
    line = planner.owner(cx, cy);
  if (!line) throw Error("Missing route");
  const request: RegionalRequest = {
    bounds: line.bounds,
    detail: "region",
    sampleStep: 16,
    limits: QUERY_LIMITS,
  };
  const result = overview(seed, request);
  expect(result.railways).toEqual(planner.query(line.bounds));
  expect(result.railways?.find((l) => l.id === line.id)?.stations.map((s) => s.town.name)).toEqual(
    line.stations.map((s) => s.town.name),
  );
  expect(result.stats.features).toBeLessThanOrEqual(QUERY_LIMITS.maxFeatures);
});
it("drops rail enumeration at bounded overview scale and on nonregional worlds", () => {
  const request: RegionalRequest = {
    bounds: { minX: -50000, minY: -50000, maxX: 50000, maxY: 50000 },
    detail: "region",
    sampleStep: 16,
    limits: QUERY_LIMITS,
  };
  const result = overview(2026, request);
  expect(result.detail).toBe("overview");
  expect(result.railways).toEqual([]);
  expect(result.stats.features).toBe(0);
  const flat = overviewSteps(createDescriptor("flat", 2026), {
    ...request,
    bounds: { minX: 0, minY: 0, maxX: 16, maxY: 16 },
  });
  let step = flat.next();
  while (!step.done) step = flat.next();
  expect(step.value.railways).toEqual([]);
});
it("allows cancellation between owner plans instead of enumerating the remaining map", () => {
  const planner = new RailwayPlanner(regionalWorld(2026));
  const owner = vi.spyOn(planner, "owner");
  const query = planner.querySteps({ minX: 0, minY: -4096, maxX: 4096, maxY: 0 });
  expect(query.next().done).toBe(false);
  expect(owner).toHaveBeenCalledTimes(1);
  query.return([]);
  expect(owner).toHaveBeenCalledTimes(1);
});

import { describe, expect, it } from "vitest";
import {
  connectionForOwner,
  intersects,
  plannedElevation,
  QUERY_LIMITS,
  queryRegion,
  REGION_SIZE,
  type RegionalRequest,
  regionalQuerySteps,
  settlementForOwner,
} from "./RegionalPlanner.js";
import { MAX_WORLD_COORDINATE, regionalWorld } from "./WorldDescriptor.js";

const world = regionalWorld(2026);
const request: RegionalRequest = {
  bounds: { minX: -2048, minY: -2048, maxX: 2048, maxY: 2048 },
  detail: "region",
  sampleStep: 32,
  limits: QUERY_LIMITS,
};

describe("regional planning", () => {
  it("is independent of query order, window partition, and worker step scheduling", () => {
    const whole = queryRegion(world, request);
    const left = { ...request, bounds: { ...request.bounds, maxX: 0 } };
    const right = { ...request, bounds: { ...request.bounds, minX: 0 } };
    const rightResult = queryRegion(world, right);
    queryRegion(regionalWorld(7), request);
    const leftResult = queryRegion(world, left);
    expect(queryRegion(world, request)).toEqual(whole);
    const merged = new Map(
      [
        ...leftResult.settlements,
        ...leftResult.connections,
        ...rightResult.settlements,
        ...rightResult.connections,
      ].map((feature) => [feature.id, feature]),
    );
    expect([...merged.values()].sort((a, b) => a.id.localeCompare(b.id))).toEqual(
      [...whole.settlements, ...whole.connections].sort((a, b) => a.id.localeCompare(b.id)),
    );
    const queryA = regionalQuerySteps(world, request);
    const queryB = regionalQuerySteps(regionalWorld(7), right);
    let step = queryA.next();
    while (!step.done) {
      queryB.next();
      step = queryA.next();
    }
    expect(step.value).toEqual(whole);
    for (const part of [leftResult, rightResult]) {
      for (let row = 0; row < part.grid.height; row++) {
        for (let col = 0; col < part.grid.width; col++) {
          const wholeCol = (part.grid.x - whole.grid.x) / whole.grid.step + col;
          const wholeRow = (part.grid.y - whole.grid.y) / whole.grid.step + row;
          expect(part.elevation[row * part.grid.width + col]).toBe(
            whole.elevation[wholeRow * whole.grid.width + wholeCol],
          );
        }
      }
    }
  });

  it("agrees at independently queried negative and positive borders", () => {
    for (const x of [-1024, 0, 1024]) {
      const a = queryRegion(world, {
        ...request,
        bounds: { minX: x - 96, minY: -1000, maxX: x + 32, maxY: 1800 },
      });
      const b = queryRegion(world, {
        ...request,
        bounds: { minX: x - 32, minY: -1000, maxX: x + 96, maxY: 1800 },
      });
      const overlap = { minX: x - 32, minY: -1000, maxX: x + 32, maxY: 1800 };
      const features = (r: ReturnType<typeof queryRegion>) =>
        [...r.settlements, ...r.connections]
          .filter((f) => intersects(f.bounds, overlap))
          .sort((p, q) => p.id.localeCompare(q.id));
      expect(features(a)).toEqual(features(b));
    }
  });

  it("gives settlements contained, dry reservations and uniquely owned connections", () => {
    for (const seed of [7, 42, 2026, 0xffffffff]) {
      const w = regionalWorld(seed);
      const result = queryRegion(w, request);
      const ids = [...result.settlements, ...result.connections].map((f) => f.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const s of result.settlements) {
        expect(s.bounds.minX).toBeGreaterThanOrEqual(s.owner.cx * REGION_SIZE);
        expect(s.bounds.maxX).toBeLessThanOrEqual((s.owner.cx + 1) * REGION_SIZE);
        expect(s.bounds.minY).toBeGreaterThanOrEqual(s.owner.cy * REGION_SIZE);
        expect(s.bounds.maxY).toBeLessThanOrEqual((s.owner.cy + 1) * REGION_SIZE);
        for (const x of [s.bounds.minX, s.center.x, s.bounds.maxX]) {
          for (const y of [s.bounds.minY, s.center.y, s.bounds.maxY])
            expect(plannedElevation(w, x, y)).toBeGreaterThanOrEqual(0.179999);
        }
        expect(settlementForOwner(w, s.owner.cx, s.owner.cy)).toEqual(s);
      }
      for (const c of result.connections) {
        const a = settlementForOwner(w, c.owner.cx, c.owner.cy);
        const axis = c.id.endsWith(":east") ? "east" : "south";
        const b = settlementForOwner(
          w,
          c.owner.cx + Number(axis === "east"),
          c.owner.cy + Number(axis === "south"),
        );
        expect(c.points[0]).toEqual(a?.center);
        expect(c.points.at(-1)).toEqual(b?.center);
        expect(c.settlementIds).toEqual([a?.id, b?.id]);
        expect(connectionForOwner(w, c.owner.cx, c.owner.cy, axis)).toEqual(c);
        for (let index = 1; index < c.points.length; index++) {
          const from = c.points[index - 1];
          const to = c.points[index];
          if (!from || !to) continue;
          const steps = Math.ceil((Math.abs(to.x - from.x) + Math.abs(to.y - from.y)) / 4);
          for (let step = 0; step <= steps; step++) {
            const t = steps ? step / steps : 0;
            for (const side of [-c.width / 2, 0, c.width / 2]) {
              const x = from.x + (to.x - from.x) * t + (from.y !== to.y ? side : 0);
              const y = from.y + (to.y - from.y) * t + (from.x !== to.x ? side : 0);
              expect(plannedElevation(w, x, y)).toBeGreaterThan(0);
            }
          }
        }
      }
    }
  });

  it("coarsens broad or low-budget delivery instead of constructing hidden detail or truncating identities", () => {
    const broad = queryRegion(world, {
      ...request,
      bounds: { minX: -1_000_000, minY: -1_000_000, maxX: 1_000_000, maxY: 1_000_000 },
      sampleStep: 4,
    });
    expect(broad.detail).toBe("overview");
    expect(broad.stats.owners).toBe(0);
    expect(broad.stats.features).toBe(0);
    expect(broad.stats.samples).toBeLessThanOrEqual(QUERY_LIMITS.maxSamples);
    expect(broad.stats.detailedChunks).toBe(0);
    const limited = queryRegion(world, {
      ...request,
      limits: { maxSamples: 64, maxOwners: 4, maxFeatures: 4 },
    });
    expect(limited.detail).toBe("overview");
    expect(limited.stats.samples).toBeLessThanOrEqual(64);
    expect(queryRegion(world, request).settlements).toEqual(
      queryRegion(world, { ...request, sampleStep: 64 }).settlements,
    );
  });

  it("rejects invalid versions, bounds, and budgets without runaway work", () => {
    expect(() =>
      queryRegion({ ...world, generatorVersion: "future" } as unknown as typeof world, request),
    ).toThrow(/version/);
    for (const invalid of [NaN, Infinity, MAX_WORLD_COORDINATE + 1])
      expect(() =>
        queryRegion(world, { ...request, bounds: { ...request.bounds, maxX: invalid } }),
      ).toThrow(/bounds/);
    for (const sampleStep of [0, NaN, 1e308])
      expect(() => queryRegion(world, { ...request, sampleStep })).toThrow(/step/);
    expect(() =>
      queryRegion(world, { ...request, limits: { ...QUERY_LIMITS, maxOwners: 1e9 } }),
    ).toThrow(/budget/);
  });
});

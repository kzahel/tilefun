import { describe, expect, it } from "vitest";
import { TerrainId } from "../../autotile/TerrainId.js";
import { createProp, getWallsForPropType, isPropType } from "../../entities/PropFactories.js";
import { Chunk } from "../../world/Chunk.js";
import { createDescriptor } from "../GenerationDescriptor.js";
import { createGenerator } from "../Generator.js";
import { overviewSteps } from "../Overview.js";
import { LANDSCAPE_PROFILES, NaturalLandscape } from "./NaturalLandscape.js";
import { LandCover, QUERY_LIMITS } from "./RegionalPlanner.js";
import { regionalWorld } from "./WorldDescriptor.js";

const chunks = Array.from({ length: 25 }, (_, i) => ({
  cx: -28 + (i % 5),
  cy: -34 + Math.floor(i / 5),
}));
function all(n: NaturalLandscape, coordinates = chunks) {
  return [
    ...new Map(
      coordinates.flatMap((c) => n.placements(c.cx, c.cy)).map((p) => [p.featureId, p]),
    ).values(),
  ].sort((a, b) => a.featureId.localeCompare(b.featureId));
}
describe("natural landscape shared composition", () => {
  it("defaults to patterned forests and retains deterministic density previews", () => {
    const byProfile = LANDSCAPE_PROFILES.map((p) =>
      all(new NaturalLandscape(regionalWorld(2026), p)),
    );
    expect(byProfile[0]?.length).toBeGreaterThan(20);
    expect(byProfile[2]?.length).toBeGreaterThan(byProfile[1]?.length ?? 0);
    const n = new NaturalLandscape(regionalWorld(2026), "balanced");
    expect(all(n, [...chunks].reverse())).toEqual(byProfile[1]);
    const ids = new Set(byProfile[1]?.map((p) => p.featureId));
    expect(byProfile[0]?.every((p) => ids.has(p.featureId))).toBe(true);
    const plain = createGenerator(createDescriptor("regional", 2026));
    expect(
      chunks
        .flatMap((c) => plain.placements(c.cx, c.cy, new Set()).placements)
        .some((p) => p.featureId?.startsWith("nature:")),
    ).toBe(true);
    const explicit = createGenerator(createDescriptor("regional", 2026), "thicket");
    for (const c of [...chunks, { cx: -5, cy: -27 }])
      expect(plain.placements(c.cx, c.cy, new Set())).toEqual(
        explicit.placements(c.cx, c.cy, new Set()),
      );
    expect(
      plain
        .placements(-5, -27, new Set())
        .placements.some((p) => p.featureId?.startsWith("nature:thicket:")),
    ).toBe(true);
  });
  it("includes canopy overhangs across negative chunk seams while keeping trunks separated", () => {
    const n = new NaturalLandscape(regionalWorld(2026), "lush"),
      trees = all(n);
    for (let i = 0; i < trees.length; i++)
      for (let j = i + 1; j < trees.length; j++) {
        const a = trees[i],
          b = trees[j];
        if (!a || !b) continue;
        expect(Math.hypot(a.wx - b.wx, a.wy - b.wy)).toBeGreaterThan(40);
      }
    const a = n.placements(-27, -32),
      b = n.placements(-26, -32);
    expect(a.some((p) => b.some((q) => q.featureId === p.featureId))).toBe(true);
  });
  it.each([2026, 7, 42])(
    "keeps vegetation dry and outside road, rail, station and settlement reservations for seed %s",
    (seed) => {
      const n = new NaturalLandscape(regionalWorld(seed), "lush"),
        start = n.railways.start();
      if (!start) throw new Error("Missing seeded route");
      const coordinates = Array.from({ length: 60 }, (_, i) => ({
        cx: Math.floor(start.x / 16) + (i % 12) - 6,
        cy: Math.floor(start.y / 16) + Math.floor(i / 12) - 2,
      }));
      for (const p of all(n, coordinates)) {
        expect(n.reserved(p.wx / 16, p.wy / 16, 4)).toBe(false);
        for (const dx of [-2, 0, 2])
          for (const dy of [-4, -2, 1])
            expect(n.terrain(p.wx / 16 + dx, p.wy / 16 + dy)).toBe(TerrainId.Grass);
      }
      expect(n.reserved(start.x, start.y)).toBe(true);
    },
  );
  it("realizes pond water and matching overview samples across chunk boundaries", () => {
    const n = new NaturalLandscape(regionalWorld(2026), "balanced"),
      pond = n.pond(1, -2);
    expect(pond).not.toBeNull();
    if (!pond) return;
    const g = createGenerator(createDescriptor("regional", 2026), "balanced");
    const left = new Chunk(),
      right = new Chunk();
    g.terrain.generate(left, 13, -13);
    g.terrain.generate(right, 14, -13);
    for (let sy = 0; sy < 33; sy++) expect(left.subgrid[sy * 33 + 32]).toBe(right.subgrid[sy * 33]);
    expect(n.terrain(pond.x, pond.y)).toBe(TerrainId.DeepWater);
    const query = overviewSteps(
      g.descriptor,
      { bounds: pond.bounds, detail: "region", sampleStep: 2, limits: QUERY_LIMITS },
      "balanced",
    );
    let step = query.next();
    while (!step.done) step = query.next();
    const result = step.value;
    for (let y = 0; y < result.grid.height; y++)
      for (let x = 0; x < result.grid.width; x++) {
        const terrain = n.terrain(
          result.grid.x + (x + 0.5) * result.grid.step,
          result.grid.y + (y + 0.5) * result.grid.step,
        );
        expect(result.cover[y * result.grid.width + x] === 0).toBe(
          terrain <= TerrainId.ShallowWater,
        );
      }
    expect(result.ponds?.some((p) => p.id === pond.id)).toBe(true);
  });
  it("bounds caches after sustained traversal", () => {
    const n = new NaturalLandscape(regionalWorld(2026), "balanced");
    for (let i = -80; i < 80; i++) {
      n.pond(i, 0);
      n.reserved(i * 128, 0);
    }
    expect(n.cacheSizes.reservations).toBeLessThanOrEqual(64);
    expect(n.cacheSizes.ponds).toBeLessThanOrEqual(128);
  });
  it("uses bounded native forest rows with stable seams and real solid footprints", () => {
    const n = new NaturalLandscape(regionalWorld(2026), "thicket");
    for (const [cx, cy, kit] of [
      [-1, -4, 1],
      [-2, -5, 2],
      [1, -5, 3],
    ] as const) {
      const rows = n.forest(cx, cy);
      expect(rows.length).toBeGreaterThan(8);
      expect(rows.every((r) => r.kit === kit)).toBe(true);
      for (const r of rows) {
        expect(r.bounds.minX).toBeGreaterThanOrEqual(cx * 128);
        expect(r.bounds.maxX).toBeLessThanOrEqual((cx + 1) * 128);
        expect(r.bounds.minY).toBeGreaterThanOrEqual(cy * 128);
        expect(r.bounds.maxY).toBeLessThanOrEqual((cy + 1) * 128);
        expect(isPropType(r.propType)).toBe(true);
        const p = createProp(r.propType, r.wx, r.wy);
        expect(p.walls).toEqual(getWallsForPropType(r.propType));
        expect(p.walls?.every((c) => !c.passable && !c.walkableTop && c.zHeight === 80)).toBe(true);
        expect(p.sprite.parts?.length).toBeGreaterThanOrEqual(4);
        for (let y = r.bounds.minY; y <= r.bounds.maxY; y += 2)
          for (let x = r.bounds.minX; x <= r.bounds.maxX; x += 2) {
            expect(n.terrain(x, y)).toBe(TerrainId.Grass);
            expect(n.reserved(x, y, 2)).toBe(false);
          }
        const seam = Math.ceil(r.ground.minX / 16);
        expect(
          n
            .placements(seam - 1, Math.floor((r.wy - 1) / 256))
            .some((p) => p.featureId === r.featureId),
        ).toBe(true);
        expect(
          n.placements(seam, Math.floor((r.wy - 1) / 256)).some((p) => p.featureId === r.featureId),
        ).toBe(true);
      }
      expect(new NaturalLandscape(regionalWorld(2026), "thicket").forest(cx, cy)).toEqual(rows);
    }
    for (let x = -80; x < 80; x++) n.forest(x, 0);
    expect(n.cacheSizes.forests).toBeLessThanOrEqual(64);
  });
  it("maps actual solid interiors separately from walkable woodland", () => {
    const n = new NaturalLandscape(regionalWorld(2026), "thicket");
    const q = overviewSteps(createDescriptor("regional", 2026), {
      bounds: { minX: -128, minY: -512, maxX: 0, maxY: -384 },
      detail: "region",
      sampleStep: 4,
      limits: QUERY_LIMITS,
    });
    let next = q.next();
    while (!next.done) next = q.next();
    const { grid, cover, stats } = next.value;
    expect(cover.includes(LandCover.Thicket)).toBe(true);
    expect(stats.detailedChunks).toBe(0);
    for (let y = 0; y < grid.height; y++)
      for (let x = 0; x < grid.width; x++)
        expect(cover[y * grid.width + x] === LandCover.Thicket).toBe(
          n.inThicket(grid.x + (x + 0.5) * grid.step, grid.y + (y + 0.5) * grid.step),
        );
  });
});

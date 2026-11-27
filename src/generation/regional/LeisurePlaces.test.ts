import { expect, it } from "vitest";
import { TerrainId } from "../../autotile/TerrainId.js";
import { createProp, getWallsForPropType, isPropType } from "../../entities/PropFactories.js";
import { required } from "../../shared/required.js";
import { Chunk } from "../../world/Chunk.js";
import { createDescriptor } from "../GenerationDescriptor.js";
import { createGenerator } from "../Generator.js";
import { overviewSteps } from "../Overview.js";
import { lakeBeach } from "./LakeShore.js";
import { NaturalLandscape } from "./NaturalLandscape.js";
import { QUERY_LIMITS } from "./RegionalPlanner.js";
import { regionalWorld } from "./WorldDescriptor.js";

it("realizes town and lake outings from the same plans used for map travel, across signed chunk seams", () => {
  const world = regionalWorld(2026),
    gen = createGenerator(createDescriptor("regional", 2026));
  const nature = new NaturalLandscape(world, "thicket");
  const camp = required(nature.outings.owner(0, 0)),
    garden = required(nature.outings.owner(-2, -3));
  const lake = required(nature.lake(2, -1)),
    beach = lakeBeach(lake, 2026);
  expect([camp.kind, garden.kind, beach.kind]).toEqual(["camp", "garden", "beach"]);
  const alternate = new NaturalLandscape(world, "thicket");
  for (const p of [beach, garden, camp]) {
    expect(alternate.leisure(p.bounds).map((v) => v.id)).toContain(p.id);
    for (const prop of p.props) {
      const cx = Math.floor(prop.wx / 256),
        cy = Math.floor(prop.wy / 256);
      expect(isPropType(prop.propType)).toBe(true);
      expect(gen.placements(cx, cy, new Set()).placements).toContainEqual(prop);
    }
    for (const a of p.actors) {
      const cx = Math.floor(a.wx / 256),
        cy = Math.floor(a.wy / 256);
      expect(gen.actors?.(cx, cy).filter((v) => v.featureId === a.featureId)).toEqual([a]);
    }
    const query = overviewSteps(world, {
      bounds: p.bounds,
      detail: "region",
      sampleStep: 16,
      limits: QUERY_LIMITS,
    });
    let result = query.next();
    while (!result.done) result = query.next();
    expect(result.value.outings).toContainEqual({
      kind: p.kind,
      arrival: p.arrival,
      name: p.name,
      id: p.id,
    });
  }
  expect(beach.bounds.minY).toBeGreaterThan(lake.y + lake.ry);
  expect(
    nature.boats(Math.floor(lake.x / 16), Math.floor((lake.y - lake.ry + 1) / 16)),
  ).toHaveLength(1);
  const dock = required(nature.outings.owner(-4, -4)),
    pond = required(dock.pond);
  const chunkAt = (tx: number, ty: number) => {
    const cx = Math.floor(tx / 16),
      cy = Math.floor(ty / 16);
    const c = new Chunk();
    gen.terrain.generate(c, cx, cy);
    return c;
  };
  const west = chunkAt(pond.x, pond.y),
    nextX = (Math.floor(pond.x / 16) + 1) * 16,
    east = chunkAt(nextX, pond.y);
  for (let i = 0; i <= 32; i++) expect(west.getSubgrid(32, i)).toBe(east.getSubgrid(0, i));
  expect(
    west.getSubgrid(
      (pond.x - Math.floor(pond.x / 16) * 16) * 2,
      (pond.y - Math.floor(pond.y / 16) * 16) * 2,
    ),
  ).toBe(TerrainId.DeepWater);
}, 20000);

it("restores the generated tree house's ladder, room and deck through the ordinary prop factory", () => {
  const nature = new NaturalLandscape(regionalWorld(2026), "thicket");
  const site = required(nature.outings.owner(-3, -3));
  const entry = required(site.props.find((p) => p.propType === "prop-tree-house"));
  const prop = createProp(entry.propType, entry.wx, entry.wy);
  expect(prop.walls?.some((w) => w.ladder)).toBe(true);
  expect(prop.walls?.some((w) => w.room)).toBe(true);
  expect(getWallsForPropType(entry.propType)).toEqual(prop.walls);
});

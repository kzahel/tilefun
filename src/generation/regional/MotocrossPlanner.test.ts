import { expect, it } from "vitest";
import { TerrainId } from "../../autotile/TerrainId.js";
import { getEntityAABB } from "../../entities/collision.js";
import { createProp } from "../../entities/PropFactories.js";
import { surfaceZAt } from "../../physics/SurfacePatch.js";
import { RoadType } from "../../road/RoadType.js";
import { required } from "../../shared/required.js";
import { Chunk } from "../../world/Chunk.js";
import { createDescriptor } from "../GenerationDescriptor.js";
import { createGenerator } from "../Generator.js";
import { DenseDistrictSource } from "./DenseDistrictPlanner.js";
import { jumpHeight, jumpLength } from "./JumpProfiles.js";
import {
  MotocrossSource,
  MX_RADIUS,
  motocrossReserved,
  motocrossRoad,
  motocrossTerrain,
} from "./MotocrossPlanner.js";
import type { NaturalStrategy } from "./NaturalStrategy.js";
import { RacetrackSource, racetrackReserved } from "./RacetrackPlanner.js";
import { intersects, settlementForOwner } from "./RegionalPlanner.js";
import { regionalWorld } from "./WorldDescriptor.js";

/** Top surface height of the realized slab props at a world-pixel point. */
function propHeight(props: ReturnType<typeof createProp>[], wx: number, wy: number) {
  for (const p of props) {
    const c = p.collider;
    if (!c?.surface) continue;
    const box = getEntityAABB(p.position, c);
    if (wx >= box.left && wx < box.right && wy >= box.top && wy < box.bottom)
      return surfaceZAt(c.surface, box, wx, wy);
  }
  return 0;
}

it.each([2026, 42, 7])("plans motocross parks opposite each city's speedway (seed %s)", (seed) => {
  const world = regionalWorld(seed),
    tracks = new RacetrackSource(world),
    parks = new MotocrossSource(world, tracks),
    cities = new DenseDistrictSource(world, true);
  let count = 0;
  for (let cy = -2; cy <= 2; cy++)
    for (let cx = -2; cx <= 2; cx++) {
      const park = parks.owner(cx, cy);
      if (!park) continue;
      count++;
      expect(settlementForOwner(world, cx, cy)?.kind).toBe("city");
      const city = required(cities.owner(cx, cy));
      expect(intersects(park.bounds, city.bounds)).toBe(false);
      const track = tracks.owner(cx, cy);
      if (track) {
        expect(Math.sign(park.center.x - city.center.x)).toBe(
          -Math.sign(track.center.x - city.center.x),
        );
        for (let y = park.bounds.minY; y <= park.bounds.maxY; y += 4)
          for (let x = park.bounds.minX; x <= park.bounds.maxX; x += 4)
            expect(racetrackReserved(track, x, y)).toBe(false);
      }
      const props = park.props.map((p) => createProp(p.propType, p.wx, p.wy));
      props.forEach((p, i) => {
        expect(p.type).toBe(park.props[i]?.propType);
        expect(motocrossReserved(park, p.position.wx / 16, p.position.wy / 16)).toBe(true);
      });
      // Every slab lies on dirt, and slabs of one run form one connected space.
      const slabs = props.filter((p) => p.type.startsWith("prop-mx-"));
      for (const slab of slabs) {
        const box = getEntityAABB(slab.position, required(slab.collider));
        expect(
          motocrossTerrain(park, (box.left + box.right) / 32, (box.top + box.bottom) / 32),
        ).toBe(TerrainId.DirtWarm);
      }
      const spaces = new Map<string, number>();
      for (const slab of slabs) {
        const space = required(slab.collider?.surface).spaceId;
        spaces.set(space, (spaces.get(space) ?? 0) + 1);
      }
      // sky 2 runs, double 2, kicker 2, tabletop 1, rollers 1.
      expect(spaces.size).toBe(8);
      // The west-bound kicker on the south straight mirrors the shared profile.
      const kicker = park.props.filter((p) => p.propType.startsWith("prop-mx-kicker-"));
      const startX = Math.max(
        ...kicker.map(
          (p) => p.wx + required(createProp(p.propType, p.wx, p.wy).collider).width / 2,
        ),
      );
      for (let t = 4; t < jumpLength("kicker"); t += 24)
        expect(propHeight(props, startX - t, (park.center.y + MX_RADIUS) * 16)).toBeCloseTo(
          jumpHeight("kicker", t),
          3,
        );
      for (const v of park.vehicles) {
        const x = Math.floor(v.wx / 16),
          y = Math.floor(v.wy / 16);
        if (v.identity.includes(":pit:")) expect(motocrossRoad(park, x, y)).toBe(RoadType.Asphalt);
        else expect(motocrossTerrain(park, v.wx / 16, v.wy / 16)).toBe(TerrainId.DirtWarm);
      }
      for (const actor of park.actors)
        expect(motocrossReserved(park, actor.wx / 16, actor.wy / 16)).toBe(true);
      expect(motocrossRoad(park, park.arrival.x, park.arrival.y)).toBe(RoadType.Asphalt);
    }
  expect(count).toBeGreaterThan(0);
});

it("realizes dirt, jump props and parked race cars through regional generation", () => {
  const generator = createGenerator(createDescriptor("regional", 2026));
  const strategy = generator.terrain as NaturalStrategy;
  const park = required(strategy.motocross.owner(0, 0));
  // A chunk on the north straight carrying sky slabs.
  const sky = required(park.props.find((p) => p.propType.startsWith("prop-mx-sky-0-")));
  const cx = Math.floor(sky.wx / 256),
    cy = Math.floor((sky.wy - 64) / 256);
  const chunk = new Chunk();
  strategy.generate(chunk, cx, cy);
  const lx = Math.floor(sky.wx / 16) - cx * 16,
    ly = Math.floor((sky.wy - 64) / 16) - cy * 16;
  expect(chunk.getSubgrid(lx * 2 + 1, ly * 2 + 1)).toBe(TerrainId.DirtWarm);
  expect(chunk.getRoad(lx, ly)).toBe(RoadType.None);
  const placed = strategy.placements(cx, cy).filter((p) => p.propType.startsWith("prop-mx-sky-"));
  expect(placed.map((p) => p.featureId)).toContain(sky.featureId);
  // The park reserves its ground from natural cover and wildlife.
  expect(strategy.nature.reserved(park.center.x, park.center.y)).toBe(true);
  const vehicles = [];
  for (let y = Math.floor(park.bounds.minY / 16); y <= Math.floor(park.bounds.maxY / 16); y++)
    for (let x = Math.floor(park.bounds.minX / 16); x <= Math.floor(park.bounds.maxX / 16); x++)
      vehicles.push(...strategy.depotVehicles(x, y).filter((v) => v.identity.includes(park.id)));
  expect(vehicles.map((v) => v.model).sort()).toEqual(park.vehicles.map((v) => v.model).sort());
});

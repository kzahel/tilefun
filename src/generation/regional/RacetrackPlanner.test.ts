import { expect, it, vi } from "vitest";
import { required } from "../../art/ArtCatalog.js";
import { TerrainId } from "../../autotile/TerrainId.js";
import { aabbOverlapsPropWalls, getEntityAABB } from "../../entities/collision.js";
import { ENTITY_FACTORIES } from "../../entities/EntityFactories.js";
import { EntityManager } from "../../entities/EntityManager.js";
import { createProp } from "../../entities/PropFactories.js";
import { isCityRoad } from "../../road/DenseCitySurface.js";
import { PARKING_SURFACE_COUNT } from "../../road/ParkingSurface.js";
import { RoadType } from "../../road/RoadType.js";
import { nextLanes, samplePath } from "../../traffic/LaneGraph.js";
import { TrafficStrategy } from "../../traffic/TrafficNetwork.js";
import { vehicleRoadWidth, vehicleView } from "../../traffic/Vehicle.js";
import { Chunk } from "../../world/Chunk.js";
import { createDescriptor } from "../GenerationDescriptor.js";
import { createGenerator } from "../Generator.js";
import { ProceduralActors } from "../ProceduralActors.js";
import { DenseDistrictSource } from "./DenseDistrictPlanner.js";
import { NaturalLandscape } from "./NaturalLandscape.js";
import { pathDistance } from "./PlanGeometry.js";
import { RacetrackSource, racetrackReserved, racetrackSurface } from "./RacetrackPlanner.js";
import { intersects, QUERY_LIMITS, queryRegion, settlementForOwner } from "./RegionalPlanner.js";
import { regionalWorld } from "./WorldDescriptor.js";

it.each([2026, 42, 7])(
  "plans deterministic city outskirts circuits away from trunk roads (seed %s)",
  (seed) => {
    const world = regionalWorld(seed),
      tracks = new RacetrackSource(world),
      cities = new DenseDistrictSource(world, true);
    let count = 0;
    for (let cy = -2; cy <= 2; cy++)
      for (let cx = -2; cx <= 2; cx++) {
        const track = tracks.owner(cx, cy);
        if (!track) continue;
        count++;
        expect(settlementForOwner(world, cx, cy)?.kind).toBe("city");
        expect(intersects(track.bounds, required(cities.owner(cx, cy)).bounds)).toBe(false);
        expect(track.actors).toHaveLength(48);
        expect(track.actors.filter((a) => a.wy < track.center.y * 16 - 36 * 16)).toHaveLength(12);
        const props = track.props.map((p) => createProp(p.propType, p.wx, p.wy));
        for (const actor of track.actors) {
          expect(racetrackReserved(track, actor.wx / 16, actor.wy / 16)).toBe(true);
          for (const point of actor.route) {
            const person = required(ENTITY_FACTORIES[actor.type])(point.wx, point.wy);
            const body = getEntityAABB(person.position, required(person.collider));
            expect(
              props.some((p) => aabbOverlapsPropWalls(body, p.position, p, 0)),
              actor.featureId,
            ).toBe(false);
            expect(
              racetrackSurface(track, Math.floor(point.wx / 16), Math.floor(point.wy / 16)),
            ).toBe(RoadType.CityPavement);
          }
        }
        for (const p of track.props)
          expect(createProp(p.propType, p.wx, p.wy).type).toBe(p.propType);
        const region = queryRegion(world, {
          bounds: track.bounds,
          detail: "region",
          sampleStep: 128,
          limits: QUERY_LIMITS,
        });
        for (const c of region.connections)
          for (let y = track.bounds.minY; y < track.bounds.maxY; y += 4)
            for (let x = track.bounds.minX; x < track.bounds.maxX; x += 4)
              expect(pathDistance(c.points, x, y)).toBeGreaterThanOrEqual(12);
        expect(new RacetrackSource(world).owner(cx, cy)).toEqual(track);
        expect(tracks.query(track.bounds).some((t) => t.id === track.id)).toBe(true);
      }
    expect(count).toBeGreaterThan(0);
  },
);

it("has two closed racing lanes whose complete car footprints stay on asphalt", () => {
  const strategy = new TrafficStrategy(regionalWorld(2026));
  const track = required(strategy.racetracks.owner(0, 0));
  const graph = strategy.trafficNetwork(track.center.x * 16, track.center.y * 16);
  const lanes = [...graph.lanes.values()].filter((l) => l.id.startsWith(track.id));
  expect(lanes).toHaveLength(8);
  expect(RoadType.ParkingStart + PARKING_SURFACE_COUNT).toBeLessThanOrEqual(RoadType.RaceCurbRed);
  for (const lane of lanes) {
    const next = nextLanes(graph, lane, vehicleRoadWidth(`vehicle-v1:${lane.race?.model}`));
    expect(next).toHaveLength(1);
    expect(next[0]?.race).toBeDefined();
    const end = samplePath(lane.path, lane.path.length),
      start = samplePath(required(next[0]).path, 0);
    expect(end.x).toBeCloseTo(start.x, 6);
    expect(end.y).toBeCloseTo(start.y, 6);
    for (let d = 0; d < lane.path.length; d += 8) {
      const pose = samplePath(lane.path, d);
      const collider = required(
        required(vehicleView(`vehicle-v1:${lane.race?.model}`, pose.direction)).metadata
          .colliders[0],
      );
      for (
        let y = Math.floor((pose.y - collider.height / 2) / 16);
        y <= Math.floor((pose.y + collider.height / 2 - 0.01) / 16);
        y++
      )
        for (
          let x = Math.floor((pose.x - collider.width / 2) / 16);
          x <= Math.floor((pose.x + collider.width / 2 - 0.01) / 16);
          x++
        )
          expect(isCityRoad(racetrackSurface(track, x, y)), `${lane.id} at ${x},${y}`).toBe(true);
    }
  }
});

it("realizes saved track paint and dry shared chunk seams while excluding natural scenery", () => {
  const generator = createGenerator(createDescriptor("regional", 2026));
  const strategy = generator.terrain as import("./NaturalStrategy.js").NaturalStrategy;
  const track = required(strategy.racetracks.owner(0, 0));
  const nature = new NaturalLandscape(regionalWorld(2026), "thicket");
  const entry = required(track.access[0]);
  const entryCx = Math.floor(entry.x / 16),
    entryCy = Math.floor(entry.y / 16);
  const original = new Chunk(),
    connected = new Chunk();
  new TrafficStrategy(regionalWorld(2026)).generate(original, entryCx, entryCy);
  strategy.generate(connected, entryCx, entryCy);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++)
      if (isCityRoad(original.getRoad(x, y)))
        expect(isCityRoad(connected.getRoad(x, y))).toBe(true);
  for (const [x, y] of [
    [track.center.x, track.center.y - 28],
    [track.center.x + 52, track.center.y],
    [track.center.x, track.center.y + 44],
  ]) {
    const px = required(x),
      py = required(y);
    expect(racetrackReserved(track, px, py)).toBe(true);
    expect(nature.reserved(px, py, 3)).toBe(true);
    const cx = Math.floor(px / 16),
      cy = Math.floor(py / 16);
    const chunk = new Chunk(),
      neighbor = new Chunk();
    strategy.generate(chunk, cx, cy);
    strategy.generate(neighbor, cx + 1, cy);
    expect(chunk.getRoad(px - cx * 16, py - cy * 16)).toBe(racetrackSurface(track, px, py));
    expect(chunk.getSubgrid((px - cx * 16) * 2, (py - cy * 16) * 2)).toBe(TerrainId.Grass);
    for (let sy = 0; sy <= 32; sy++)
      expect(chunk.getSubgrid(32, sy)).toBe(neighbor.getSubgrid(0, sy));
    expect(
      strategy.nature
        .placements(cx, cy)
        .filter((p) => racetrackReserved(track, p.wx / 16, p.wy / 16)),
    ).toHaveLength(0);
  }
});

it("backfills spectators without evaluating other seeded populations", () => {
  const generator = createGenerator(createDescriptor("regional", 2026));
  const strategy = generator.terrain as import("./NaturalStrategy.js").NaturalStrategy;
  const actors = vi.spyOn(generator, "actors");
  const wildlife = vi.spyOn(strategy.nature, "wildlife");
  const manager = new EntityManager();
  const population = new ProceduralActors(manager, new Set(), () => {});
  population.persistent = true;
  population.reconcile(generator, ["32,28"], true);
  expect(manager.entities.length).toBeGreaterThan(0);
  expect(manager.entities.every((e) => e.proceduralId?.includes(":racetrack:"))).toBe(true);
  expect(actors).not.toHaveBeenCalled();
  expect(wildlife).not.toHaveBeenCalled();
});

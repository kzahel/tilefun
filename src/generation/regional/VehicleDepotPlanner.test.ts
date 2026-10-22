import { expect, it } from "vitest";
import { required } from "../../art/ArtCatalog.js";
import { aabbOverlapsPropWalls, getEntityAABB } from "../../entities/collision.js";
import { createProp } from "../../entities/PropFactories.js";
import { createVehicle } from "../../traffic/Vehicle.js";
import { Chunk } from "../../world/Chunk.js";
import { createDescriptor } from "../GenerationDescriptor.js";
import { createGenerator } from "../Generator.js";
import { overviewSteps } from "../Overview.js";
import { NaturalStrategy } from "./NaturalStrategy.js";
import { RacetrackSource, racetrackRadius, racetrackSurface } from "./RacetrackPlanner.js";
import { QUERY_LIMITS } from "./RegionalPlanner.js";
import { depotPlacements, depotSurface, vehicleDepot } from "./VehicleDepotPlanner.js";
import { regionalWorld } from "./WorldDescriptor.js";

it("keeps the playground in the dry reserved infield, clear of the racing lanes and props", () => {
  const track = required(new RacetrackSource(regionalWorld(2026)).owner(0, 0));
  const depot = vehicleDepot(track);
  expect(new Set(depot.vehicles.map((v) => v.identity)).size).toBe(7);
  const props = depot.props.map((p) => createProp(p.propType, p.wx, p.wy));
  for (const v of depot.vehicles) {
    const e = createVehicle(v.model, v.wx, v.wy, v.facing);
    const box = getEntityAABB(e.position, required(e.collider));
    for (const x of [box.left, box.right])
      for (const y of [box.top, box.bottom])
        expect(racetrackRadius(track, x / 16, y / 16)).toBeLessThan(20);
    expect(
      props.some((p) =>
        aabbOverlapsPropWalls(box, p.position, p, 0, e.collider?.physicalHeight ?? 32),
      ),
    ).toBe(false);
    expect(depotSurface(depot, Math.floor(v.wx / 16), Math.floor(v.wy / 16))).toBeDefined();
  }
  expect(vehicleDepot(required(new RacetrackSource(regionalWorld(2026)).owner(0, 0)))).toEqual(
    depot,
  );
});

it("realizes road paint and cross-chunk bridge footprints without changing the race circuit", () => {
  const strategy = new NaturalStrategy(regionalWorld(2026), "balanced");
  const track = required(strategy.racetracks.owner(0, 0)),
    depot = vehicleDepot(track);
  const x = Math.floor(depot.center.x / 16),
    y = Math.floor(depot.center.y / 16);
  const a = new Chunk(),
    b = new Chunk();
  strategy.generate(a, x, y);
  strategy.generate(b, x + 1, y);
  for (let j = 0; j <= 32; j++) expect(a.getSubgrid(32, j)).toBe(b.getSubgrid(0, j));
  const west = required(depot.props.find((p) => p.propType === "prop-depot-bridge-west"));
  const box = getEntityAABB(
    createProp(west.propType, west.wx, west.wy).position,
    required(createProp(west.propType, west.wx, west.wy).collider),
  );
  const bounds = {
    minX: Math.floor(box.left / 256) * 16,
    minY: Math.floor(box.top / 256) * 16,
    maxX: Math.floor(box.left / 256) * 16 + 16,
    maxY: Math.floor(box.top / 256) * 16 + 16,
  };
  expect(depotPlacements(depot, bounds)).toContainEqual(west);
  expect(strategy.placements(bounds.minX / 16, bounds.minY / 16)).toContainEqual(west);
  const rx = track.center.x,
    ry = track.center.y - 28;
  const chunk = new Chunk(),
    cx = Math.floor(rx / 16),
    cy = Math.floor(ry / 16);
  strategy.generate(chunk, cx, cy);
  expect(chunk.getRoad(rx - cx * 16, ry - cy * 16)).toBe(racetrackSurface(track, rx, ry));
});

it("maps the same named depot and safe arrival without vehicle/prop payloads", () => {
  const track = required(new RacetrackSource(regionalWorld(2026)).owner(0, 0)),
    depot = vehicleDepot(track);
  const iterator = overviewSteps(createDescriptor("regional", 2026), {
    bounds: track.bounds,
    detail: "region",
    sampleStep: 16,
    limits: QUERY_LIMITS,
  });
  let next = iterator.next();
  while (!next.done) next = iterator.next();
  expect(next.value.vehicleDepots).toContainEqual({
    id: depot.id,
    name: depot.name,
    center: depot.center,
    arrival: depot.arrival,
    bounds: depot.bounds,
  });
  expect(next.value.stats.features).toBeLessThanOrEqual(QUERY_LIMITS.maxFeatures);
  expect(createGenerator(createDescriptor("flat", 1)).terrain).not.toBeInstanceOf(NaturalStrategy);
});

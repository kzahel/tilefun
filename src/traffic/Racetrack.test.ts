import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { EntityManager } from "../entities/EntityManager.js";
import { createPlayer } from "../entities/Player.js";
import { createProp } from "../entities/PropFactories.js";
import { PropManager } from "../entities/PropManager.js";
import { createDescriptor } from "../generation/GenerationDescriptor.js";
import { createGenerator } from "../generation/Generator.js";
import type { NaturalStrategy } from "../generation/regional/NaturalStrategy.js";
import { World } from "../world/World.js";
import { samplePath } from "./LaneGraph.js";
import { TrafficSystem } from "./TrafficSystem.js";
import { vehicleRoofSize } from "./Vehicle.js";

it("races eight durable cars for multiple laps, yields to people, and resumes after restore", () => {
  const generator = createGenerator(createDescriptor("regional", 2026));
  const strategy = generator.terrain as NaturalStrategy;
  const track = required(strategy.racetracks.owner(0, 0));
  const world = new World(strategy),
    entities = new EntityManager(),
    props = new PropManager();
  const range = {
    minCx: Math.floor(track.bounds.minX / 16),
    minCy: Math.floor(track.bounds.minY / 16),
    maxCx: Math.floor(track.bounds.maxX / 16),
    maxCy: Math.floor(track.bounds.maxY / 16),
  };
  world.updateLoadedChunks(range, Infinity);
  for (const p of track.props) props.add(createProp(p.propType, p.wx, p.wy));
  const player = entities.spawn(createPlayer(track.center.x * 16, (track.center.y + 37) * 16));
  const traffic = new TrafficSystem(world, entities, props, strategy);
  traffic.visibleRanges = [range];
  traffic.tick(1 / 60, [player]);
  const racers = [...traffic.states.values()].filter((s) => s.lane.race);
  expect(racers).toHaveLength(8);
  const identities = racers.map((s) => s.entity.proceduralId).sort();
  const roofCar = required(racers[0]);
  const roofHeight = required(required(roofCar.entity.collider).physicalHeight);
  player.position = { wx: roofCar.entity.position.wx, wy: roofCar.entity.position.wy + 3 };
  player.wz = player.groundZ = roofHeight;
  entities.spatialHash.update(player);
  for (let i = 0; i < 3600; i++) {
    traffic.tick(1 / 30, [player]);
    // Saves may land on any tick, including the exact tangent handoff.
    expect(racers.every((s) => !s.turn && s.distance <= s.lane.path.length)).toBe(true);
  }
  for (const car of racers) {
    expect(car.choices, `${car.lane.id}: ${car.waiting}`).toBeGreaterThanOrEqual(8);
    expect(car.speed).toBeGreaterThan(100);
  }
  expect([...traffic.states.values()].filter((s) => s.lane.race)).toHaveLength(8);
  expect(player.wz).toBe(roofHeight);
  expect(
    Math.hypot(
      player.position.wx - roofCar.entity.position.wx,
      player.position.wy - roofCar.entity.position.wy,
    ),
  ).toBeLessThanOrEqual(vehicleRoofSize(roofCar.entity.type) / 2);
  const saved = traffic.save().filter((s) => s.identity.includes(":racetrack:"));
  for (const car of racers) entities.remove(car.entity.id, false);
  traffic.restore(saved);
  const restored = [...traffic.states.values()].filter((s) => s.lane.race);
  expect(restored.map((s) => s.entity.proceduralId).sort()).toEqual(identities);
  expect(traffic.save().filter((s) => s.identity.includes(":racetrack:"))).toEqual(saved);
  const car = required(restored[0]);
  // A player in the road stops the racer through the ordinary traffic collision owner.
  const ahead = samplePath(car.lane.path, car.distance + 130);
  player.position = { wx: ahead.x, wy: ahead.y };
  player.wz = player.groundZ = 0;
  entities.spatialHash.update(player);
  for (let i = 0; i < 180; i++) traffic.tick(1 / 60, [player]);
  expect(car.speed).toBe(0);
  expect(car.waiting).toBe("crossing");
  player.position = { wx: track.center.x * 16, wy: track.center.y * 16 };
  entities.spatialHash.update(player);
  for (let i = 0; i < 180; i++) traffic.tick(1 / 60, [player]);
  expect(car.speed).toBeGreaterThan(20);
  traffic.takeControl(car, player.id);
  const parkedAt = { ...car.entity.position };
  traffic.releaseControl(car);
  expect(car.parked).toBe(true);
  for (let i = 0; i < 180; i++) traffic.tick(1 / 60, [player]);
  expect(car.entity.position).toEqual(parkedAt);
  const parkedRecord = traffic.snapshot(car);
  entities.remove(car.entity.id, false);
  traffic.restore([parkedRecord]);
  const parkedCopy = required(
    [...traffic.states.values()].find((s) => s.entity.proceduralId === parkedRecord.identity),
  );
  expect(parkedCopy.parked).toBe(true);
  expect(parkedCopy.entity.position).toEqual(parkedAt);
}, 60000);

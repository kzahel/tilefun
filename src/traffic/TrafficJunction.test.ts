import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import { EntityManager } from "../entities/EntityManager.js";
import { createPlayer } from "../entities/Player.js";
import { PropManager } from "../entities/PropManager.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { World } from "../world/World.js";
import { buildLaneGraph, samplePath } from "./LaneGraph.js";
import { TrafficStrategy } from "./TrafficNetwork.js";
import { TrafficSystem } from "./TrafficSystem.js";
import { vehicleRoadWidth } from "./Vehicle.js";

function junction(width = 6) {
  const segments = [];
  for (let i = 0; i <= 2; i++) {
    segments.push({ a: { x: 0, y: i * 40 }, b: { x: 80, y: i * 40 }, width, intercity: false });
    segments.push({ a: { x: i * 40, y: 0 }, b: { x: i * 40, y: 80 }, width, intercity: false });
  }
  const graph = buildLaneGraph(segments);
  const strategy = new TrafficStrategy(regionalWorld(2026));
  strategy.trafficNetwork = () => graph;
  const world = new World(strategy);
  world.getRoadAt = () => 5;
  world.getHeightAt = () => 0;
  const entities = new EntityManager();
  const traffic = new TrafficSystem(world, entities, new PropManager(), strategy);
  const incoming = [...graph.lanes.values()].filter((l) => l.to === "40,40");
  return { graph, world, entities, traffic, incoming };
}

it.each([4, 6, 8].flatMap((width) => [-1, 0, 1].map((turn) => [width, turn])))(
  "clears four competing approaches on %s-tile roads with turn %s without overlap",
  (width, turn) => {
    const f = junction(width);
    const cars = f.incoming.map((lane) => {
      expect(lane.width).toBeGreaterThanOrEqual(vehicleRoadWidth("vehicle-v1:compact-1"));
      const car = f.traffic.add("compact-1", lane, lane.path.length - 110);
      car.next = required(
        (f.graph.outgoing.get(lane.to) ?? []).find(
          (next) =>
            next.to !== lane.from &&
            Math.sign(
              (lane.b.x - lane.a.x) * (next.b.y - next.a.y) -
                (lane.b.y - lane.a.y) * (next.b.x - next.a.x),
            ) === turn,
        ),
      );
      return car;
    });
    for (let i = 0; i < 3600; i++) {
      f.traffic.tick(1 / 60, []);
      for (const [index, car] of cars.entries()) {
        for (const other of cars.slice(index + 1)) {
          expect(
            aabbsOverlap(
              getEntityAABB(car.entity.position, required(car.entity.collider)),
              getEntityAABB(other.entity.position, required(other.entity.collider)),
            ),
          ).toBe(false);
        }
      }
    }
    for (const car of cars) expect(car.choices).toBeGreaterThan(1);
  },
);

it("waits outside a genuinely occupied exit and resumes after it clears", () => {
  const f = junction();
  const lane = required(f.incoming[0]);
  const exit = required(f.graph.lanes.get("40,40>80,40"));
  const car = f.traffic.add("compact-1", lane, lane.path.length - 110);
  car.next = exit;
  const blocker = f.traffic.add("compact-1", exit, 40);
  blocker.parked = true;
  for (let i = 0; i < 600; i++) f.traffic.tick(1 / 60, []);
  expect(car.speed).toBe(0);
  expect(car.turn).toBeUndefined();
  expect(car.reservation).toBeUndefined();
  expect(car.waiting).toBe("traffic");
  f.entities.remove(blocker.entity.id, false);
  for (let i = 0; i < 600; i++) f.traffic.tick(1 / 60, []);
  expect(car.choices).toBeGreaterThan(0);
});

it("reroutes before entering when only the selected junction exit has lost its road", () => {
  const f = junction();
  const lane = required(f.incoming[0]);
  const exit = required(f.graph.lanes.get("40,40>80,40"));
  const car = f.traffic.add("compact-1", lane, lane.path.length - 110);
  car.next = exit;
  const obstruction = samplePath(exit.path, 48);
  f.world.getRoadAt = (x, y) =>
    x === Math.floor(obstruction.x / 16) && y === Math.floor(obstruction.y / 16) ? 0 : 5;
  for (let i = 0; i < 1800; i++) f.traffic.tick(1 / 60, []);
  expect(car.choices).toBeGreaterThan(0);
});

it("recovers approaches already stopped inside the new junction safety gap", () => {
  const f = junction(4);
  const cars = f.incoming.map((lane) => {
    const car = f.traffic.add("compact-1", lane, 0);
    const half =
      Math.max(required(car.entity.collider).width, required(car.entity.collider).height) / 2;
    car.distance = lane.path.length - half - 8;
    const pose = samplePath(lane.path, car.distance);
    car.entity.position = { wx: pose.x, wy: pose.y };
    f.entities.spatialHash.update(car.entity);
    car.next = required(
      (f.graph.outgoing.get(lane.to) ?? []).find(
        (next) =>
          next.to !== lane.from &&
          (lane.b.x - lane.a.x) * (next.b.y - next.a.y) -
            (lane.b.y - lane.a.y) * (next.b.x - next.a.x) <
            0,
      ),
    );
    return car;
  });
  for (let i = 0; i < 3600; i++) f.traffic.tick(1 / 60, []);
  for (const car of cars) expect(car.choices).toBeGreaterThan(0);
});

it("does not back a yielding approach into a pedestrian behind it", () => {
  const f = junction(4);
  const lane = required(f.incoming[0]);
  const car = f.traffic.add("compact-1", lane, lane.path.length - 36);
  car.next = required(f.graph.lanes.get("40,40>80,40"));
  const owner = f.traffic.add("compact-1", car.next, 200);
  owner.parked = true;
  f.traffic.reservations.set(lane.to, owner.entity.id);
  const pedestrian = f.entities.spawn(
    createPlayer(car.entity.position.wx - 36, car.entity.position.wy + 3),
  );
  const start = car.entity.position.wx;
  for (let i = 0; i < 240; i++) {
    f.traffic.tick(1 / 60, []);
    expect(
      aabbsOverlap(
        getEntityAABB(car.entity.position, required(car.entity.collider)),
        getEntityAABB(pedestrian.position, required(pedestrian.collider)),
      ),
    ).toBe(false);
  }
  expect(car.entity.position.wx).toBeGreaterThan(start - 4);
  f.entities.remove(pedestrian.id, false);
  for (let i = 0; i < 120; i++) f.traffic.tick(1 / 60, []);
  expect(car.entity.position.wx).toBeCloseTo(start - f.traffic.settings.gap);
});

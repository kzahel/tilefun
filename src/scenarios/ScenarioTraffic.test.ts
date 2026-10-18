import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { buildLaneGraph } from "../traffic/LaneGraph.js";
import { createVehicle } from "../traffic/Vehicle.js";
import { FLAT_SCENARIO } from "./ScenarioRecipe.js";
import { ScenarioSession } from "./ScenarioSession.js";
import { trafficRecipe } from "./TrafficRecipe.js";

it.each([
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
])("walks off a car edge (%s,%s) without falling inside the body", async (dx, dy) => {
  const car = createVehicle("compact-1", 0, 0, Direction.Right);
  const player = createPlayer(0, 3);
  player.wz = player.groundZ = car.collider?.physicalHeight ?? 24;
  const session = await ScenarioSession.create({
    version: 1,
    id: "car-edges",
    generation: FLAT_SCENARIO,
    player,
    props: [],
    actors: [car],
  });
  try {
    for (let i = 0; i < 90; i++) await session.step({ dx, dy, jump: false, sprinting: false });
    expect(
      Math.hypot(session.player.player.position.wx, session.player.player.position.wy),
    ).toBeGreaterThan(60);
    expect(session.player.player.wz).toBe(0);
  } finally {
    await session.close();
  }
});
it("runs the generated traffic recipe through Realm braking and roof rides", async () => {
  const s = await ScenarioSession.create(trafficRecipe());
  try {
    for (let i = 0; i < 180; i++) await s.step({ dx: 0, dy: 0, jump: false, sprinting: false });
    const car = s.realm.entityManager.entities.find((e) => e.id === s.handles.car);
    if (!car) throw new Error("Missing car fixture");
    expect(Math.hypot(car.velocity?.vx ?? 0, car.velocity?.vy ?? 0)).toBeLessThan(1);
    await s.command({ kind: "traffic-position", roof: true });
    const start = { ...car.position };
    for (let i = 0; i < 120; i++) await s.step({ dx: 0, dy: 0, jump: false, sprinting: false });
    expect(Math.hypot(car.position.wx - start.wx, car.position.wy - start.wy)).toBeGreaterThan(10);
    expect(s.player.player.wz).toBe(car.collider?.physicalHeight);
  } finally {
    await s.close();
  }
}, 30000);
it("keeps a roof passenger supported through a generated junction in the real Realm", async () => {
  const session = await ScenarioSession.create(trafficRecipe());
  try {
    await session.command({ kind: "traffic-position", roof: true });
    const car = [...(session.realm.traffic?.states.values() ?? [])].find(
      (s) => s.entity.id === session.handles.car,
    );
    if (!car) throw new Error("Missing car fixture");
    for (let i = 0; i < 3000 && car.choices === 0; i++) {
      await session.step({ dx: 0, dy: 0, jump: false, sprinting: false });
      expect(session.player.player.wz).toBe(car.entity.collider?.physicalHeight);
    }
    expect(car.choices).toBeGreaterThan(0);
    await session.reload();
    expect(session.handles.car).toBeDefined();
    await session.command({ kind: "traffic-position", roof: true });
    expect(session.player.player.wz).toBe(24);
  } finally {
    await session.close();
  }
}, 30000);

it("clears competing junction queues through Realm save/reload", async () => {
  const segments = [];
  for (let i = 0; i <= 2; i++) {
    segments.push({ a: { x: 0, y: i * 40 }, b: { x: 80, y: i * 40 }, width: 4, intercity: false });
    segments.push({ a: { x: i * 40, y: 0 }, b: { x: i * 40, y: 80 }, width: 4, intercity: false });
  }
  const graph = buildLaneGraph(segments);
  const incoming = [...graph.lanes.values()].filter((lane) => lane.to === "40,40");
  const session = await ScenarioSession.create({
    version: 1,
    id: "junction-queues",
    generation: FLAT_SCENARIO,
    player: createPlayer(760, 760),
    props: [],
    trafficLanes: [...graph.lanes.values()],
    roads: [
      { left: -128, right: 896, top: -128, bottom: 896 },
      { left: 896, right: 1408, top: -128, bottom: 896 },
      { left: -128, right: 1408, top: 896, bottom: 1408 },
    ],
    traffic: incoming.map((lane, i) => ({
      name: `car-${i}`,
      model: "compact-1",
      laneId: lane.id,
      x: 640,
      y: 640,
      distance: lane.path.length - 110,
    })),
  });
  try {
    const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
    for (let i = 0; i < 180; i++) await session.step(idle);
    await session.reload();
    for (let i = 0; i < 1800; i++) await session.step(idle);
    for (let i = 0; i < incoming.length; i++) {
      const car = required(
        session.realm.traffic?.states.get(required(session.handles[`car-${i}`])),
      );
      expect(
        car.choices,
        JSON.stringify({
          waiting: car.waiting,
          position: car.entity.position,
          distance: car.distance,
          turn: !!car.turn,
          reservation: car.reservation,
          next: car.next?.id,
        }),
      ).toBeGreaterThan(0);
    }
  } finally {
    await session.close();
  }
}, 30000);

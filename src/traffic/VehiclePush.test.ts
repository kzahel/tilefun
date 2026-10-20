import { describe, expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { createBall } from "../entities/Ball.js";
import { Direction } from "../entities/Entity.js";
import { EntityManager } from "../entities/EntityManager.js";
import { createPlayer } from "../entities/Player.js";
import type { Prop } from "../entities/Prop.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import { boxDepth } from "../physics/OrientedBox.js";
import { World } from "../world/World.js";
import { drivenCarPose } from "./Driving.js";
import { applyVehicleFacing, createVehicle, VEHICLE_MODELS } from "./Vehicle.js";
import { entityBody } from "./VehicleContact.js";
import { vehiclePerformance } from "./VehiclePerformance.js";
import { commitVehiclePushes, planVehiclePushes, type VehiclePush } from "./VehiclePush.js";

function fixture() {
  const world = new World(new FlatStrategy());
  for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) world.getChunk(x, y);
  const entities = new EntityManager();
  const car = entities.spawn(createVehicle("compact-1", 0, 0, Direction.Right));
  car.collider = { offsetX: 0, offsetY: 10, width: 20, height: 20, physicalHeight: 24 };
  const player = entities.spawn(createPlayer(15, 0));
  const after = { ...car, position: { wx: 0.5, wy: 0 } };
  const plan = (props: Prop[] = [], weight = 80) =>
    planVehiclePushes(
      [{ before: car, after }],
      1 / 60,
      { pushSpeed: 40, pushWeight: weight },
      world,
      props,
      entities.entities,
    );
  return { world, entities, car, player, after, plan };
}
describe("gentle vehicle contacts", () => {
  it("plans without mutation, commits a bounded nudge, and preserves voluntary velocity", () => {
    const f = fixture();
    f.player.velocity = { vx: -10, vy: 2 };
    const plan = required(f.plan());
    expect(f.player.position.wx).toBe(15);
    expect(plan).toHaveLength(1);
    commitVehiclePushes(plan, f.entities);
    expect(f.player.position.wx).toBeCloseTo(15.501);
    expect(f.player.velocity).toEqual({ vx: -10, vy: 2 });
    expect(f.entities.spatialHash.queryRange(0, -1, 0, 0)).toContain(f.player);
  });
  it("stops at walls, other people, water, unready terrain and ledges without partial pushes", () => {
    const f = fixture();
    const wall: Prop = {
      id: 1,
      type: "wall",
      position: { wx: 24, wy: 0 },
      sprite: { sheetKey: "wall", frameCol: 0, frameRow: 0, spriteWidth: 1, spriteHeight: 1 },
      collider: { offsetX: 0, offsetY: 10, width: 8, height: 20 },
      walls: null,
      isProp: true,
    };
    expect(f.plan([wall])).toBeUndefined();
    const other = f.entities.spawn(createPlayer(25, 0));
    expect(f.plan()).toBeUndefined();
    f.entities.remove(other.id, false);
    const getCollision = f.world.getCollisionIfLoaded.bind(f.world);
    f.world.getCollisionIfLoaded = () => 3;
    expect(f.plan()).toBeUndefined();
    f.world.getCollisionIfLoaded = getCollision;
    const getChunk = f.world.getChunkIfLoaded.bind(f.world);
    f.world.getChunkIfLoaded = () => undefined;
    expect(f.plan()).toBeUndefined();
    f.world.getChunkIfLoaded = getChunk;
    f.world.getHeightAt = () => 32;
    expect(f.plan()).toBeUndefined();
    expect(f.player.position.wx).toBe(15);
  });
  it("gives heavy vehicles more pushing capacity and never moves fixed bodies or roof riders", () => {
    const f = fixture();
    f.player.type = "test-crate";
    f.player.wanderAI = {
      state: "idle",
      timer: 0,
      dirX: 0,
      dirY: 0,
      idleMin: 1,
      idleMax: 2,
      walkMin: 1,
      walkMax: 2,
      speed: 10,
      directional: false,
    };
    f.player.weight = 200;
    expect(f.plan()).toBeUndefined();
    expect(f.plan([], 600)).toHaveLength(1);
    f.player.wanderAI = null;
    expect(f.plan([], 600)).toBeUndefined();
    f.player.type = "player";
    f.player.wz = f.player.groundZ = 24;
    expect(f.plan()).toEqual([]);
  });
  it("bounds pushes at high speed and validates all contacts before committing", () => {
    const f = fixture();
    f.after.position.wx = 2;
    expect(f.plan()).toBeUndefined();
    f.after.position.wx = 0.5;
    f.player.position.wy = -4;
    const second = f.entities.spawn(createPlayer(15, 4));
    second.velocity = null;
    expect(f.plan()).toBeUndefined();
    expect(f.player.position.wx).toBe(15);
  });
  it("slows a driven car at contact, keeps autonomous probes blocking, and does not damage players", () => {
    const f = fixture();
    const car = createVehicle("compact-1", 0, 0, Direction.Right);
    car.id = f.car.id;
    car.velocity = { vx: 112, vy: 0 };
    const width = required(car.collider).width;
    f.player.position.wx = width / 2 + 5;
    const bodies = [car, f.player];
    expect(drivenCarPose(car, { dx: 1, dy: 0 }, 1 / 60, f.world, [], bodies)).toBeUndefined();
    const pushes: VehiclePush[] = [];
    const next = required(
      drivenCarPose(car, { dx: 1, dy: 0 }, 1 / 60, f.world, [], bodies, undefined, pushes),
    );
    expect(next.velocity?.vx).toBeLessThanOrEqual(40);
    expect(pushes).toHaveLength(1);
    expect(f.player.deathTimer).toBeUndefined();
  });
});
it("assigns finite tuning to every vehicle and sportier silhouettes outrun ordinary cars and trucks", () => {
  for (const model of VEHICLE_MODELS) {
    const p = vehiclePerformance(`vehicle-v1:${model}`);
    expect(p.speed).toBeGreaterThan(0);
    expect(p.acceleration).toBeGreaterThan(0);
    expect(p.pushSpeed).toBeLessThanOrEqual(80);
  }
  expect(vehiclePerformance("vehicle-v1:car-25").speed).toBeGreaterThan(
    vehiclePerformance("vehicle-v1:sedan-12").speed,
  );
  expect(vehiclePerformance("vehicle-v1:sedan-12").speed).toBeGreaterThan(
    vehiclePerformance("vehicle-v1:bus-1").speed,
  );
  expect(vehiclePerformance("vehicle-v1:garbage-truck-green").acceleration).toBeLessThan(
    vehiclePerformance("vehicle-v1:car-25").acceleration,
  );
});

it("nudges non-solid balls as movable objects", () => {
  const f = fixture();
  f.entities.remove(f.player.id, false);
  const ball = f.entities.spawn(createBall(12, 0));
  const plan = required(f.plan());
  expect(plan).toHaveLength(1);
  commitVehiclePushes(plan, f.entities);
  expect(ball.position.wx).toBeGreaterThan(12.5);
});
it.each([
  [1, 0, 15, 0],
  [-1, 0, -15, 0],
  [0, 1, 0, 16],
  [0, -1, 0, -10],
])("pushes in travel direction %s,%s", (dx, dy, x, y) => {
  const f = fixture();
  f.player.position = { wx: x, wy: y };
  f.after.position = { wx: dx * 0.5, wy: dy * 0.5 };
  const push = required(f.plan()?.[0]);
  expect((push.position.wx - x) * dx + (push.position.wy - y) * dy).toBeCloseTo(0.501);
});

it("keeps airborne height and jumping velocity when a replicated player has no cached ground height", () => {
  const f = fixture();
  f.player.wz = 4;
  f.player.jumpZ = 4;
  f.player.jumpVZ = 20;
  delete f.player.groundZ;
  const plan = required(f.plan());
  commitVehiclePushes(plan, f.entities);
  expect(f.player.wz).toBe(4);
  expect(f.player.jumpVZ).toBe(20);
});

it("nudges at the real diagonal bumper without clearing the empty query-box corner", () => {
  const f = fixture();
  const angle = Math.fround(-Math.PI / 3),
    dx = Math.cos(angle),
    dy = Math.sin(angle);
  f.car.vehicleHeading = angle;
  applyVehicleFacing(f.car);
  f.car.velocity = { vx: dx * 112, vy: dy * 112 };
  const distance = 29.5 + 5 * Math.abs(dx) + 3 * Math.abs(dy) + 0.02;
  f.player.position = { wx: dx * distance, wy: dy * distance + 3 };
  const pushes: VehiclePush[] = [];
  const next = required(
    drivenCarPose(
      f.car,
      { dx: 0, dy: -1, relativeDriving: true },
      1 / 60,
      f.world,
      [],
      f.entities.entities,
      undefined,
      pushes,
    ),
  );
  expect(pushes).toHaveLength(1);
  const push = required(pushes[0]);
  expect(
    Math.hypot(push.position.wx - f.player.position.wx, push.position.wy - f.player.position.wy),
  ).toBeLessThan(0.7);
  expect(
    boxDepth(entityBody(next), entityBody({ ...f.player, position: push.position })),
  ).toBeLessThanOrEqual(0);
});

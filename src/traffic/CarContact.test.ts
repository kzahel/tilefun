import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import { Direction, type Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import { World } from "../world/World.js";
import { separatesContact } from "./ContactRecovery.js";
import { drivenCarPose } from "./Driving.js";
import { applyVehicleFacing, createVehicle, VEHICLE_MODELS } from "./Vehicle.js";
import type { VehiclePush } from "./VehiclePush.js";

function fixture() {
  const world = new World(new FlatStrategy());
  for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) world.getChunk(x, y);
  const car = createVehicle("compact-1", 0, 0, Direction.Right);
  car.id = 1;
  car.vehicleHeading = 0;
  applyVehicleFacing(car);
  return { world, car };
}
const box = (car: Entity) => getEntityAABB(car.position, required(car.collider));
const wall = (x: number): Prop => ({
  id: 1,
  type: "test-wall",
  position: { wx: x, wy: 0 },
  sprite: { sheetKey: "test", frameCol: 0, frameRow: 0, spriteWidth: 1, spriteHeight: 1 },
  collider: { width: 8, height: 200, offsetX: 0, offsetY: 100 },
  walls: null,
  isProp: true,
});

it("covers a rotating body continuously between the native cardinal views for every car", () => {
  for (const model of VEHICLE_MODELS) {
    const car = createVehicle(model, 0, 0);
    car.vehicleHeading = 0;
    applyVehicleFacing(car);
    const length = required(car.collider).width,
      breadth = required(car.collider).height;
    for (let step = 0; step < 32; step++) {
      const angle = (step * Math.PI) / 16;
      car.vehicleHeading = angle;
      applyVehicleFacing(car);
      const bounds = box(car);
      for (const x of [-length / 2, length / 2])
        for (const y of [-breadth / 2, breadth / 2]) {
          const wx = x * Math.cos(angle) - y * Math.sin(angle);
          const wy = x * Math.sin(angle) + y * Math.cos(angle);
          expect(wx).toBeGreaterThanOrEqual(bounds.left - 1e-8);
          expect(wx).toBeLessThanOrEqual(bounds.right + 1e-8);
          expect(wy).toBeGreaterThanOrEqual(bounds.top - 1e-8);
          expect(wy).toBeLessThanOrEqual(bounds.bottom + 1e-8);
        }
    }
  }
});

it("rejects diagonal car contacts outside the old cardinal collider, with and without pushes", () => {
  const { world, car } = fixture();
  car.vehicleHeading = Math.fround(Math.PI / 4);
  applyVehicleFacing(car);
  const obstacle = createVehicle("compact-1", 0, 0, Direction.Right);
  obstacle.position.wy = box(car).bottom + required(obstacle.collider).height / 2 + 0.02;
  obstacle.id = 2;
  expect(aabbsOverlap(box(car), box(obstacle))).toBe(false);
  for (const pushes of [undefined, [] as VehiclePush[]]) {
    expect(
      drivenCarPose(car, { dx: 1, dy: 1 }, 1 / 60, world, [], [car, obstacle], undefined, pushes),
    ).toBeUndefined();
    expect(pushes ?? []).toEqual([]);
  }
});

for (const kind of ["car", "building", "tile"] as const)
  it(`backs out of an existing ${kind} overlap, but cannot drive deeper`, () => {
    const { world, car } = fixture();
    // Small overlap represents a restored old footprint or another moving body.
    const obstacle = createVehicle("compact-1", box(car).right + 27.8, 0);
    obstacle.id = 2;
    const props = kind === "building" ? [wall(box(car).right + 3.8)] : [];
    const bodies = kind === "car" ? [car, obstacle] : [car];
    if (kind === "tile") {
      car.position.wx = 4.2; // The calibrated right edge lies slightly inside the tile at x=32.
      world.getCollisionIfLoaded = (x) => (x === 2 ? CollisionFlag.Solid : 0);
    }
    expect(
      drivenCarPose(car, { dx: 1, dy: 0 }, 1 / 60, world, props, bodies, undefined, []),
    ).toBeUndefined();
    const before = structuredClone(car);
    let moving = car;
    for (let step = 0; step < 15; step++)
      moving = required(
        drivenCarPose(moving, { dx: -1, dy: 0 }, 1 / 60, world, props, bodies, undefined, []),
      );
    expect(moving.position.wx).toBeLessThan(car.position.wx - 4);
    expect(car).toEqual(before);
    if (kind === "car") expect(aabbsOverlap(box(moving), box(obstacle))).toBe(false);
  });

it("does not allow overlap recovery to tunnel into a new obstacle or expand into a neighbor", () => {
  const a = { left: -28, right: 28, top: -12, bottom: 12 };
  const obstacle = { left: 27.8, right: 80, top: -20, bottom: 20 };
  expect(separatesContact(a, { ...a, left: -29, right: 27 }, obstacle)).toBe(true);
  expect(separatesContact(a, { ...a, left: -29, right: 29 }, obstacle)).toBe(false);
  const { car, world } = fixture();
  const front = wall(31.8),
    rear = wall(-32.02);
  expect(
    drivenCarPose(car, { dx: -1, dy: 0 }, 1 / 60, world, [front, rear], [car], undefined, []),
  ).toBeUndefined();
});

it("can retreat diagonally from a car overlap when one axis gets closer but the exit gets nearer", () => {
  const { car, world } = fixture();
  car.vehicleHeading = Math.fround(Math.PI / 4);
  applyVehicleFacing(car);
  const other = createVehicle("compact-1", 25, -10);
  other.id = 2;
  const next = required(
    drivenCarPose(car, { dx: -1, dy: -1 }, 1 / 60, world, [], [car, other], undefined, []),
  );
  expect(next.position.wx).toBeLessThan(car.position.wx);
  expect(next.position.wy).toBeLessThan(car.position.wy);
});

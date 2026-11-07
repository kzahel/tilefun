import { afterEach, expect, it } from "vitest";
import { Direction, type Entity } from "../entities/Entity.js";
import { required } from "../shared/required.js";
import { TOW, towAnchors } from "../traffic/Towing.js";
import { TRANSPORTER, transporterLoadCandidate } from "../traffic/Transporter.js";
import { createVehicle } from "../traffic/Vehicle.js";
import { linkVehicles, unlinkVehicle } from "../traffic/VehicleLinks.js";
import { rotateBodyVector } from "./BodyRotation.js";
import { type PhysicsGeometry, PhysicsScene } from "./PhysicsScene.js";
import type { MotionIntent } from "./PhysicsState.js";

const scenes: PhysicsScene[] = [];
afterEach(() => {
  for (const scene of scenes.splice(0)) scene.dispose();
});
async function create() {
  const s = await PhysicsScene.create();
  scenes.push(s);
  return s;
}
const flat: PhysicsGeometry = {
  getCollision: () => 0,
  getHeight: () => 0,
  queryProps: () => [],
  geometryVersion: () => ({ identity: 1, revision: 0 }),
};
function vehicle(model: string, wx: number, id: number): Entity {
  return { ...createVehicle(model, wx, 0, Direction.Right), id, proceduralId: `test:${id}` };
}
function run(
  scene: PhysicsScene,
  bodies: Entity[],
  ticks: number,
  intents: ReadonlyMap<number, MotionIntent> = new Map(),
) {
  for (let i = 0; i < ticks; i++) {
    scene.synchronize(bodies);
    scene.step(intents, flat);
  }
}
const local = (e: Entity, x: number) => {
  const h = e.vehicleHeading ?? 0;
  return { x: e.position.wx + x * Math.cos(h), y: e.position.wy + x * Math.sin(h) };
};

it("tows a car by its lifted front axle through driving and a turn, then releases it", async () => {
  const scene = await create(),
    truck = vehicle("tow-truck", 0, 1);
  const front = towAnchors({ type: "vehicle-v1:compact-1" }).car.x,
    car = vehicle("compact-1", TOW.hitch - front - 4, 2);
  const bodies = [truck, car];
  run(scene, bodies, 30);
  linkVehicles(truck, car, "tow");
  run(scene, bodies, 60);
  const gap = () => {
    const hitch = local(truck, TOW.hitch),
      axle = local(car, front);
    return Math.hypot(hitch.x - axle.x, hitch.y - axle.y);
  };
  expect(gap()).toBeLessThan(6);
  // The front axle is lifted: the car pitches nose-up on its rear wheels.
  expect(rotateBodyVector(required(car.bodyRotation), 1, 0, 0).z).toBeGreaterThan(0.05);
  const start = car.position.wx;
  run(scene, bodies, 150, new Map([[1, { vx: 0, vy: 0, driveSpeed: 64, heading: 0 }]]));
  expect(car.position.wx - start).toBeGreaterThan(80);
  expect(gap()).toBeLessThan(6);
  run(scene, bodies, 240, new Map([[1, { vx: 0, vy: 0, driveSpeed: 64, heading: Math.PI / 2 }]]));
  expect(required(car.vehicleHeading)).toBeGreaterThan(0.8);
  expect(gap()).toBeLessThan(8);
  run(scene, bodies, 90);
  unlinkVehicle(truck, car);
  run(scene, bodies, 90);
  expect(rotateBodyVector(required(car.bodyRotation), 0, 0, 1).z).toBeGreaterThan(0.995);
  expect(Math.abs(car.wz ?? 0)).toBeLessThan(1);
});

it("drives a car up the deployed ramp, secures it for the journey and drives it off", async () => {
  const scene = await create(),
    truck = vehicle("car-transporter", 0, 1),
    car = vehicle("compact-1", -230, 2);
  truck.vehicleRamp = 1;
  const bodies = [truck, car];
  run(scene, bodies, 30);
  run(scene, bodies, 280, new Map([[2, { vx: 0, vy: 0, driveSpeed: 48, heading: 0 }]]));
  run(scene, bodies, 90);
  expect((car.wz ?? 0) - (truck.wz ?? 0)).toBeGreaterThan(TRANSPORTER.height - 3);
  const load = transporterLoadCandidate(truck, bodies);
  expect(load?.id).toBe(car.id);
  delete truck.vehicleRamp;
  linkVehicles(truck, required(load), "carry");
  run(scene, bodies, 30);
  run(scene, bodies, 180, new Map([[1, { vx: 0, vy: 0, driveSpeed: 64, heading: 0 }]]));
  expect(truck.position.wx).toBeGreaterThan(100);
  const x = local(truck, TRANSPORTER.loadX);
  expect(Math.hypot(car.position.wx - x.x, car.position.wy - x.y)).toBeLessThan(4);
  expect((car.wz ?? 0) - (truck.wz ?? 0)).toBeGreaterThan(TRANSPORTER.height - 3);
  run(scene, bodies, 90);
  truck.vehicleRamp = 1;
  unlinkVehicle(truck, car);
  run(scene, bodies, 30);
  run(scene, bodies, 420, new Map([[2, { vx: 0, vy: 0, driveSpeed: -32, heading: 0 }]]));
  expect(car.position.wx).toBeLessThan(truck.position.wx + TRANSPORTER.toe);
  expect(Math.abs((car.wz ?? 0) - (truck.wz ?? 0))).toBeLessThan(2);
});

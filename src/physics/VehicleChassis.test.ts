import { afterEach, expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { Direction } from "../entities/Entity.js";
import { surfaceProp } from "../scenarios/WorldGeometryRecipe.js";
import { decodeServerMessage, encodeServerMessage } from "../shared/binaryCodec.js";
import { createVehicle } from "../traffic/Vehicle.js";
import { rotateBodyVector } from "./BodyRotation.js";
import { PHYSICS_DT, PHYSICS_PIXELS_PER_METRE } from "./PhysicsDefaults.js";
import { type PhysicsGeometry, PhysicsScene } from "./PhysicsScene.js";

const scenes: PhysicsScene[] = [];
afterEach(() => {
  for (const scene of scenes.splice(0)) scene.dispose();
});
async function create() {
  const s = await PhysicsScene.create();
  scenes.push(s);
  return s;
}
const props = [
  surfaceProp(
    { left: 0, top: -64, right: 128, bottom: 64 },
    { id: "ramp", spaceId: "upper", z: 0, riseX: 32, riseY: 0, thickness: 6, connectsTo: ["deck"] },
  ),
  surfaceProp(
    { left: 128, top: -64, right: 224, bottom: 64 },
    { id: "deck", spaceId: "upper", z: 32, riseX: 0, riseY: 0, thickness: 6, connectsTo: ["ramp"] },
  ),
];
const geometry: PhysicsGeometry = {
  getCollision: () => 0,
  getHeight: () => 0,
  queryProps: () => props,
  geometryVersion: () => ({ identity: props, revision: 0 }),
};

it("climbs with actual chassis pitch and crosses onto the level deck", async () => {
  const scene = await create(),
    car = createVehicle("compact-1", -64, 0, Direction.Right);
  car.id = 1;
  let pitch = 0,
    elevated = false;
  for (let tick = 0; tick < 150; tick++) {
    scene.synchronize([car]);
    scene.step(new Map([[1, { vx: 0, vy: 0, driveSpeed: 112, heading: 0 }]]), geometry);
    const state = required(scene.bodyState(1));
    pitch = Math.max(pitch, Math.abs(rotateBodyVector(required(state.rotation), 1, 0, 0).z));
    elevated ||= state.x > 140 && state.z > 29;
  }
  expect(pitch).toBeGreaterThan(0.15);
  expect(elevated).toBe(true);
  expect(car.position.wx).toBeGreaterThan(150);
  expect(scene.diagnostics.worldSteps).toBe(150);
  expect(scene.diagnostics.bodyCreates).toBe(1);
});

it("pushes a parked chassis with bounded actual contact penetration and brakes after release", async () => {
  const scene = await create();
  const cars = [0, 100].map((x, i) => ({
    ...createVehicle("compact-1", x, 0, Direction.Right),
    id: i + 1,
  }));
  const flat = { ...geometry, queryProps: () => [] };
  let deepest = 0,
    settledDepth = 0,
    contacts = 0;
  for (let tick = 0; tick < 360; tick++) {
    scene.synchronize(cars);
    scene.step(
      new Map([[1, { vx: 0, vy: 0, driveSpeed: tick < 180 ? 112 : 0, steering: 0 }]]),
      flat,
    );
    const colliders: Parameters<typeof scene.world.contactPair>[0][] = [];
    scene.world.forEachCollider((c) => {
      if (c.parent()?.isDynamic()) colliders.push(c);
    });
    const [a, b] = colliders;
    // Query current collider transforms; the solver manifold describes its
    // incident pose and can retain pre-solve penetration after integration.
    const contact = a && b ? a.contactCollider(b, 0.01) : undefined;
    if (contact) {
      contacts++;
      deepest = Math.max(deepest, -contact.distance * PHYSICS_PIXELS_PER_METRE);
      if (tick > 330)
        settledDepth = Math.max(settledDepth, -contact.distance * PHYSICS_PIXELS_PER_METRE);
    }
  }
  expect(contacts).toBeGreaterThan(0);
  // A discrete impact may compress within one tick of approach travel; resting
  // contact must converge below a quarter world pixel, without passing through.
  expect(deepest).toBeLessThan(112 * PHYSICS_DT);
  expect(settledDepth).toBeLessThan(0.25);
  expect(cars[1]?.position.wx).toBeGreaterThan(110);
  expect(cars[0]?.position.wx).toBeLessThan(cars[1]?.position.wx ?? 0);
  expect(Math.hypot(cars[0]?.velocity?.vx ?? 0, cars[0]?.velocity?.vy ?? 0)).toBeLessThan(0.1);
});

it("tips an unsupported truck and retains full rotation/momentum through wire restore and replay", async () => {
  const scene = await create(),
    replay = await create();
  const truck = createVehicle("dump-truck", 160, 74, Direction.Right);
  truck.id = 1;
  truck.wz = 32;
  let sideways = false;
  for (let tick = 0; tick < 90; tick++) {
    scene.synchronize([truck]);
    scene.step(new Map(), geometry);
    sideways ||= rotateBodyVector(required(required(scene.bodyState(1)).rotation), 0, 0, 1).z < 0.6;
  }
  expect(sideways).toBe(true);
  const snapshot = scene.snapshot();
  const decoded = decodeServerMessage(
    encodeServerMessage({
      type: "frame",
      serverTick: 90,
      lastProcessedInputSeq: 0,
      playerEntityId: 1,
      physics: snapshot,
    }),
  );
  if (decoded.type !== "frame" || !decoded.physics) throw Error("Expected physics frame");
  const clone = createVehicle("dump-truck", truck.position.wx, truck.position.wy, Direction.Right);
  clone.id = 1;
  replay.synchronize([clone]);
  replay.restore(decoded.physics);
  expect(required(replay.bodyState(1)).rotation).toEqual(
    required(decoded.physics.bodies[0]).rotation,
  );
  expect(required(replay.bodyState(1)).angularVelocity).toEqual(
    required(decoded.physics.bodies[0]).angularVelocity,
  );
  for (let tick = 0; tick < 20; tick++) {
    scene.synchronize([truck]);
    replay.synchronize([clone]);
    scene.step(new Map(), geometry);
    replay.step(new Map(), geometry);
  }
  expect(
    Math.hypot(
      clone.position.wx - truck.position.wx,
      clone.position.wy - truck.position.wy,
      (clone.wz ?? 0) - (truck.wz ?? 0),
    ),
  ).toBeLessThan(0.5);
  const a = required(truck.bodyRotation),
    b = required(clone.bodyRotation);
  expect(Math.abs(a.reduce((dot, n, i) => dot + n * required(b[i]), 0))).toBeGreaterThan(0.99);
});

it("retains airborne translation and rotation instead of steering or levelling in mid-air", async () => {
  const scene = await create(),
    car = createVehicle("compact-1", 300, 0, Direction.Right);
  car.id = 1;
  car.wz = 100;
  car.velocity = { vx: 96, vy: 37 };
  car.bodyAngularVelocity = [0.7, 0.4, 1];
  for (let i = 0; i < 10; i++) {
    scene.synchronize([car]);
    scene.step(new Map([[1, { vx: 0, vy: 0, driveSpeed: -56, heading: Math.PI }]]), geometry);
  }
  expect(car.velocity?.vx).toBeCloseTo(96, 3);
  expect(car.velocity?.vy).toBeCloseTo(37, 3);
  expect(scene.bodyState(1)?.grounded).toBe(false);
  expect(Math.abs(car.bodyRotation?.[0] ?? 0)).toBeGreaterThan(0.04);
  expect(car.wz).toBeLessThan(100);
});

it("rights an overturned car on the same floor and lets the parked suspension sleep", async () => {
  const scene = await create(),
    car = createVehicle("compact-1", 320, 0, Direction.Right);
  car.id = 1;
  car.wz = 24;
  car.bodyRotation = [1, 0, 0, 0];
  for (let i = 0; i < 180; i++) {
    scene.synchronize([car]);
    scene.step(new Map(), geometry);
  }
  expect(rotateBodyVector(required(car.bodyRotation), 0, 0, 1).z).toBeLessThan(-0.9);
  scene.recoverVehicle(1);
  expect(rotateBodyVector(required(car.bodyRotation), 0, 0, 1).z).toBeGreaterThan(0.99);
  expect(car.bodyAngularVelocity).toEqual([0, 0, 0]);
  for (let i = 0; i < 60; i++) {
    scene.synchronize([car]);
    scene.step(new Map(), geometry);
  }
  expect(Math.abs(car.wz ?? Infinity)).toBeLessThan(0.5);
  expect(scene.bodyState(1)?.sleeping).toBe(true);
});

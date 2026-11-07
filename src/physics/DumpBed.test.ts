import { afterEach, expect, it } from "vitest";
import { createBall } from "../entities/Ball.js";
import { Direction, type Entity } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { surfaceProp } from "../scenarios/WorldGeometryRecipe.js";
import {
  physicsStateBytes,
  readPhysicsState,
  writePhysicsState,
} from "../shared/physicsStateCodec.js";
import { required } from "../shared/required.js";
import { DUMP_BED } from "../traffic/DumpBed.js";
import { createVehicle } from "../traffic/Vehicle.js";
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
function flat(props: ReturnType<typeof surfaceProp>[] = []): PhysicsGeometry {
  return {
    getCollision: () => 0,
    getHeight: () => 0,
    queryProps: () => props,
    geometryVersion: () => ({ identity: props, revision: 0 }),
  };
}
/** Bed centre (local x = -20) for a truck facing +x at the origin. */
const BED_X = -20;
function setup() {
  const truck = { ...createVehicle("dump-truck", 0, 0, Direction.Right), id: 1 };
  const player = { ...createPlayer(BED_X + 12, 0), id: 2 };
  player.wz = 40;
  player.jumpVZ = 0;
  const ball = { ...createBall(BED_X - 14, 6), id: 3 };
  ball.wz = 40;
  ball.jumpVZ = 0;
  return { truck, player, ball, bodies: [truck, player, ball] as Entity[] };
}
function run(
  scene: PhysicsScene,
  bodies: Entity[],
  ticks: number,
  geometry = flat(),
  intents: ReadonlyMap<number, MotionIntent> = new Map(),
) {
  for (let i = 0; i < ticks; i++) {
    scene.synchronize(bodies);
    scene.step(intents, geometry);
  }
}

it("supports a person and loose cargo on the recessed bed floor, not the level roof", async () => {
  const scene = await create(),
    { truck, player, ball, bodies } = setup();
  run(scene, bodies, 120);
  const floor = (truck.wz ?? 0) + DUMP_BED.floorZ;
  expect(player.wz ?? 0).toBeGreaterThan(floor - 2);
  expect(player.wz ?? 0).toBeLessThan(floor + 2);
  expect(required(scene.bodyState(player.id)).supportId).toBe(truck.id);
  expect(ball.wz ?? 0).toBeLessThan(floor + 4);
  expect(Math.abs(ball.position.wy)).toBeLessThan(20);
});

it("carries bed contents through driving, a turn and braking inside the walls", async () => {
  const scene = await create(),
    { truck, player, ball, bodies } = setup();
  run(scene, bodies, 90);
  run(scene, bodies, 90, flat(), new Map([[1, { vx: 0, vy: 0, driveSpeed: 64, heading: 0 }]]));
  run(
    scene,
    bodies,
    180,
    flat(),
    new Map([[1, { vx: 0, vy: 0, driveSpeed: 64, heading: Math.PI / 2 }]]),
  );
  run(scene, bodies, 120);
  const heading = truck.vehicleHeading ?? 0;
  expect(heading).toBeGreaterThan(1.2);
  // Riders turn with the bed rather than keeping their world offset from its centre.
  const local = (e: Entity) => {
    const dx = e.position.wx - truck.position.wx,
      dy = e.position.wy - truck.position.wy;
    return {
      x: dx * Math.cos(heading) + dy * Math.sin(heading),
      y: -dx * Math.sin(heading) + dy * Math.cos(heading),
    };
  };
  for (const actor of [player, ball]) {
    const p = local(actor);
    expect(p.x).toBeGreaterThan(-52);
    expect(p.x).toBeLessThan(-4);
    expect(Math.abs(p.y)).toBeLessThan(15);
    expect((actor.wz ?? 0) - (truck.wz ?? 0)).toBeGreaterThan(DUMP_BED.floorZ - 3);
  }
});

it("tips through the shared clock, locks driving, discharges cargo and lowers again", async () => {
  const scene = await create(),
    { truck, ball, bodies } = setup();
  const contents = bodies.filter((e) => e !== bodies[1]);
  run(scene, contents, 90);
  truck.vehicleBedTarget = Math.fround(DUMP_BED.maxTilt);
  const drive = new Map([[1, { vx: 0, vy: 0, driveSpeed: 64, heading: 0 }]]);
  const start = truck.position.wx;
  run(scene, contents, 60, flat(), drive);
  const partial = truck.vehicleBedTilt ?? 0;
  expect(partial).toBeGreaterThan(0.2);
  expect(partial).toBeLessThan(DUMP_BED.maxTilt);
  expect(Math.abs(truck.position.wx - start)).toBeLessThan(1);
  run(scene, contents, 300, flat(), drive);
  expect(truck.vehicleBedTilt).toBe(truck.vehicleBedTarget);
  expect(Math.abs(truck.position.wx - start)).toBeLessThan(1);
  // The open tailgate releases the ball behind the truck onto the ground.
  expect(ball.position.wx).toBeLessThan(truck.position.wx - 56);
  expect(ball.wz ?? 0).toBeLessThan(2);
  delete truck.vehicleBedTarget;
  run(scene, contents, 240);
  expect(truck.vehicleBedTilt).toBeUndefined();
  run(scene, contents, 120, flat(), drive);
  expect(truck.position.wx - start).toBeGreaterThan(20);
});

it("stops a raising bed below a low ceiling and resumes after the obstruction clears", async () => {
  const scene = await create(),
    truck = { ...createVehicle("dump-truck", 0, 0, Direction.Right), id: 1 };
  const ceiling = surfaceProp(
    { left: -40, top: -40, right: 40, bottom: 40 },
    { id: "roof", spaceId: "roof", z: 64, riseX: 0, riseY: 0, thickness: 4, connectsTo: [] },
  );
  const covered = flat([ceiling]);
  run(scene, [truck], 30, covered);
  truck.vehicleBedTarget = Math.fround(DUMP_BED.maxTilt);
  run(scene, [truck], 240, covered);
  const blocked = truck.vehicleBedTilt ?? 0;
  expect(blocked).toBeGreaterThan(0);
  expect(blocked).toBeLessThan(DUMP_BED.maxTilt * 0.8);
  run(scene, [truck], 240);
  expect(truck.vehicleBedTilt).toBe(truck.vehicleBedTarget);
});

it("replays a mid-tip numerical snapshot identically after the binary round trip", async () => {
  const authority = await create(),
    replica = await create(),
    { truck, ball } = setup();
  const bodies = [truck, ball];
  run(authority, bodies, 90);
  truck.vehicleBedTarget = Math.fround(DUMP_BED.maxTilt);
  run(authority, bodies, 40);
  const state = authority.snapshot();
  const bytes = new DataView(new ArrayBuffer(physicsStateBytes(state)));
  writePhysicsState(bytes, 0, state);
  const [decoded] = readPhysicsState(bytes, 0);
  const vehicle = required(decoded?.bodies.find((b) => b.id === truck.id));
  expect(vehicle.bedTilt).toBe(truck.vehicleBedTilt);
  expect(vehicle.bedTarget).toBe(truck.vehicleBedTarget);
  // A replica's entities carry only replicated fields; restore supplies the clock.
  const copies = bodies.map((e) => structuredClone(e));
  for (const copy of copies) {
    delete copy.vehicleBedTilt;
    delete copy.vehicleBedTarget;
  }
  replica.synchronize(copies);
  replica.restore(required(decoded));
  for (let i = 0; i < 60; i++) {
    authority.step(new Map(), flat());
    replica.step(new Map(), flat());
  }
  const truckCopy = required(copies[0]),
    ballCopy = required(copies[1]);
  expect(truckCopy.vehicleBedTilt).toBe(truck.vehicleBedTilt);
  expect(ballCopy.position.wx).toBeCloseTo(ball.position.wx, 3);
  expect(ballCopy.wz ?? 0).toBeCloseTo(ball.wz ?? 0, 3);
});

// A body asleep in the solver is neither read back nor motored again until
// something wakes it. Each case below is one way out of that rest.
import { afterEach, expect, it } from "vitest";
import { createPlayer } from "../entities/Player.js";
import { createFauna } from "../wildlife/Fauna.js";
import { teleportBody } from "./PhysicalEdits.js";
import { type PhysicsGeometry, PhysicsScene } from "./PhysicsScene.js";
import type { MotionIntent } from "./PhysicsState.js";

const scenes: PhysicsScene[] = [];
afterEach(() => {
  for (const s of scenes.splice(0)) s.dispose();
});
const ground: PhysicsGeometry = {
  getCollision: () => 0,
  getHeight: () => 0,
  queryProps: () => [],
  geometryVersion: () => ({ identity: ground, revision: 0 }),
};
const idle = new Map<number, MotionIntent>();

/** A scene whose actors have come to rest; `tick` reports the work one more step did. */
async function settled(...actors: ReturnType<typeof createFauna>[]) {
  const s = await PhysicsScene.create();
  scenes.push(s);
  actors.forEach((e, i) => {
    e.id = i + 1;
  });
  const tick = (intents: ReadonlyMap<number, MotionIntent> = idle, bodies = actors) => {
    const { bodyReads, motorUpdates } = s.diagnostics;
    s.synchronize(bodies);
    s.step(intents, ground);
    return {
      reads: s.diagnostics.bodyReads - bodyReads,
      motors: s.diagnostics.motorUpdates - motorUpdates,
    };
  };
  for (let i = 0; i < 240; i++) tick();
  return { s, tick };
}

it("stops reading and motoring bodies that came to rest, and keeps their published pose", async () => {
  const dogs = Array.from({ length: 12 }, (_, i) => createFauna("dog", i * 40, 0));
  const { tick } = await settled(...dogs);
  const before = dogs.map((e) => ({ ...e.position, wz: e.wz, groundZ: e.groundZ }));
  // Another writer may leave a pose arc on the entity; readback still clears it.
  for (const e of dogs) e.jumpZ = 5;
  expect(tick()).toEqual({ reads: 0, motors: 0 });
  expect(dogs.map((e) => ({ ...e.position, wz: e.wz, groundZ: e.groundZ }))).toEqual(before);
  for (const e of dogs) {
    expect(e.jumpZ).toBe(0);
    expect(e.prevPosition).toEqual(e.position);
    expect(e.velocity).toEqual({ vx: 0, vy: 0 });
    expect(e.jumpVZ).toBeUndefined();
  }
});

it("moves a resting body on the tick its motor asks for motion", async () => {
  const dog = createFauna("dog", 0, 0),
    other = createFauna("dog", 200, 0);
  const { tick } = await settled(dog, other);
  const x = dog.position.wx;
  expect(tick(new Map([[dog.id, { vx: 60, vy: 0 }]]))).toEqual({ reads: 1, motors: 1 });
  expect(dog.position.wx).toBeGreaterThan(x + 0.5);
  expect(dog.velocity?.vx).toBeCloseTo(60, 0);
  expect(other.position.wx).toBe(200);
});

it("wakes a resting body when a moving one runs into it and records the contact", async () => {
  const player = createPlayer(0, 32),
    dog = createFauna("dog", 40, 32);
  const { s, tick } = await settled(player, dog);
  const x = dog.position.wx;
  // The player's motor is never dormant (ladders, controls); the dog's is.
  expect(tick()).toEqual({ reads: 0, motors: 1 });
  const push = new Map([[player.id, { vx: 64, vy: 0 }]]);
  let touched = false;
  for (let i = 0; i < 90; i++) {
    tick(push);
    touched ||= !!s.contactIds(dog.id)?.has(player.id);
  }
  expect(touched).toBe(true);
  expect(dog.position.wx).toBeGreaterThan(x + 10);
});

it("follows an explicit teleport or launch of a resting body", async () => {
  const dog = createFauna("dog", 0, 0);
  const { s, tick } = await settled(dog);
  teleportBody(dog, { wx: 300, wy: 80, wz: 0 });
  tick();
  expect(s.bodyState(dog.id)).toMatchObject({ x: 300, y: 80 });
  expect(dog.position).toEqual({ wx: 300, wy: 80 });
  for (let i = 0; i < 240; i++) tick();
  expect(tick()).toEqual({ reads: 0, motors: 0 });
  dog.jumpVZ = 120;
  tick();
  expect(dog.wz).toBeGreaterThan(0.5);
  expect(dog.jumpVZ).toBeDefined();
});

it("publishes the cached pose to a replacement entity object", async () => {
  const dog = createFauna("dog", 0, 0);
  const { tick } = await settled(dog);
  const copy = { ...dog, position: { ...dog.position } };
  delete copy.prevPosition;
  delete copy.groundZ;
  tick(idle, [copy]);
  expect(copy.prevPosition).toEqual(copy.position);
  expect(copy.groundZ).toBe(dog.groundZ);
});

it("drops a body resting on another when its support is removed", async () => {
  const lower = createFauna("dog", 0, 0),
    upper = createFauna("dog", 0, 0);
  upper.wz = 40;
  const { s, tick } = await settled(lower, upper);
  const height = upper.wz ?? 0;
  expect(height).toBeGreaterThan(4);
  expect(s.bodyState(upper.id)?.supportId).toBe(lower.id);
  // Both are asleep and unread; the rider's motor still watches its support.
  expect(tick()).toEqual({ reads: 0, motors: 1 });
  expect(s.contactIds(upper.id)?.has(lower.id)).toBe(true);
  for (let i = 0; i < 60; i++) tick(idle, [upper]);
  expect(upper.wz ?? Infinity).toBeLessThan(0.5);
  expect(s.bodyState(upper.id)?.supportId).toBeUndefined();
});

it("carries a body resting on a support that starts to move", async () => {
  const lower = createFauna("dog", 0, 0),
    upper = createFauna("dog", 0, 0);
  upper.wz = 40;
  const { tick } = await settled(lower, upper);
  const x = upper.position.wx;
  expect(tick()).toEqual({ reads: 0, motors: 1 });
  const walk = new Map([[lower.id, { vx: 40, vy: 0 }]]);
  for (let i = 0; i < 30; i++) tick(walk);
  expect(lower.position.wx).toBeGreaterThan(10);
  expect(upper.position.wx).toBeGreaterThan(x + 5);
});

it("keeps resting through a snapshot restore and still answers the next intent", async () => {
  const dog = createFauna("dog", 0, 0);
  const { s, tick } = await settled(dog);
  const snapshot = s.snapshot();
  tick(new Map([[dog.id, { vx: 60, vy: 0 }]]));
  s.restore(snapshot);
  expect(dog.position.wx).toBe(snapshot.bodies[0]?.x);
  expect(tick().reads).toBe(1);
  const x = dog.position.wx;
  tick(new Map([[dog.id, { vx: 60, vy: 0 }]]));
  expect(dog.position.wx).toBeGreaterThan(x + 0.5);
});

it("keeps reading an anchor, which the solver never wakes, and sees what rests on it", async () => {
  const anchor = createFauna("dog", 0, 0),
    rider = createFauna("dog", 0, 0);
  anchor.wanderAI = null;
  rider.wz = 40;
  const { s, tick } = await settled(anchor, rider);
  expect(s.bodyState(anchor.id)?.kind).toBe("fixed");
  expect(s.bodyState(rider.id)?.supportId).toBe(anchor.id);
  // The rider rests unread; the anchor is read every tick and lists the rider.
  expect(tick().reads).toBe(1);
  expect(s.contactIds(anchor.id)?.has(rider.id)).toBe(true);
  expect(s.contactIds(rider.id)?.has(anchor.id)).toBe(true);
});

it("lists a resting pair's contact both ways and keeps it in the prediction closure", async () => {
  const lower = createFauna("dog", 0, 0),
    upper = createFauna("dog", 0, 0),
    far = createFauna("dog", 900, 0);
  upper.wz = 40;
  const { s, tick } = await settled(lower, upper, far);
  expect(tick().reads).toBe(0);
  expect(s.contactIds(upper.id)?.has(lower.id)).toBe(true);
  expect(s.contactIds(lower.id)?.has(upper.id)).toBe(true);
  const near = s.snapshotAround(upper.id, new Set([lower.id, upper.id, far.id]));
  expect(near.bodies.map((b) => b.id).sort()).toEqual([lower.id, upper.id]);
  expect(near.contacts).toEqual([[lower.id, upper.id]]);
});

it("rebuilds a resting body whose collider changed and keeps its pose", async () => {
  const dog = createFauna("dog", 0, 0);
  const { s, tick } = await settled(dog);
  const created = s.diagnostics.bodyCreates,
    pose = { ...dog.position, wz: dog.wz };
  if (!dog.collider) throw Error("dog has no collider");
  dog.collider = { ...dog.collider, width: dog.collider.width + 4 };
  expect(tick().reads).toBe(1);
  expect(s.diagnostics.bodyCreates).toBe(created + 1);
  expect(dog.position.wx).toBeCloseTo(pose.wx, 3);
  expect(dog.position.wy).toBeCloseTo(pose.wy, 3);
  expect(Math.abs((dog.wz ?? 0) - (pose.wz ?? 0))).toBeLessThan(0.2);
});

it("replays a push into a resting body the same from a restored, awake copy", async () => {
  // Prediction restores characters awake (only vehicles replicate sleep); the
  // authority's copy is asleep and unread. Both must answer the same push.
  const actors = () => [
    createPlayer(0, 32),
    createFauna("dog", 40, 32),
    createFauna("dog", 64, 32),
  ];
  const authority = await settled(...actors());
  expect(authority.tick()).toEqual({ reads: 0, motors: 1 });
  const replica = actors();
  replica.forEach((e, i) => {
    e.id = i + 1;
  });
  const replay = await PhysicsScene.create();
  scenes.push(replay);
  replay.synchronize(replica);
  replay.restore(authority.s.snapshot());
  const push = new Map([[1, { vx: 64, vy: 0 }]]);
  for (let i = 0; i < 90; i++) {
    authority.tick(push);
    replay.synchronize(replica);
    replay.step(push, ground);
    for (const body of replica) {
      const truth = authority.s.bodyState(body.id),
        guess = replay.bodyState(body.id);
      expect(
        Math.hypot((truth?.x ?? 0) - (guess?.x ?? 1e9), (truth?.y ?? 0) - (guess?.y ?? 1e9)),
      ).toBeLessThan(0.05);
    }
  }
  expect(authority.s.bodyState(3)?.x ?? 0).toBeGreaterThan(70);
});

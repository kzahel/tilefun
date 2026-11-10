// A napping actor's body is held: it stays in the world, asleep, and the scene's
// per-tick passes leave it alone until the solver itself wakes it.
import { afterEach, expect, it } from "vitest";
import type { Entity } from "../entities/Entity.js";
import { isNapping } from "../entities/naps.js";
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

/** Actors at rest; `tick(live, held)` steps once and reports the work it did. */
async function settled(...actors: Entity[]) {
  const s = await PhysicsScene.create();
  scenes.push(s);
  actors.forEach((e, i) => {
    e.id = i + 1;
  });
  const tick = (live: Entity[], held: Entity[] = [], intents = idle) => {
    const { bodyReads, motorUpdates } = s.diagnostics;
    s.synchronize(live, undefined, held);
    s.step(intents, ground);
    return {
      reads: s.diagnostics.bodyReads - bodyReads,
      motors: s.diagnostics.motorUpdates - motorUpdates,
    };
  };
  for (let i = 0; i < 240; i++) tick(actors);
  return { s, tick };
}
/** Mark an actor as napping, as RealmNaps does, so a wake is visible on it. */
const nap = (e: Entity) => {
  e.napFrom = 1;
  e.napUntil = 1e9;
  return e;
};

it("reports a resting body restful, and not one that moves, was edited or is ridden", async () => {
  const dog = createFauna("dog", 0, 0),
    walker = createFauna("dog", 200, 0),
    player = createPlayer(400, 0);
  const { s, tick } = await settled(dog, walker, player);
  tick([dog, walker, player], [], new Map([[walker.id, { vx: 30, vy: 0 }]]));
  expect(s.restful(dog)).toBe(true);
  expect(s.restful(walker)).toBe(false);
  // A player's motor is never dormant.
  expect(s.restful(player)).toBe(false);
  expect(s.restful({ ...dog })).toBe(false);
  dog.position.wx += 3;
  expect(s.restful(dog)).toBe(false);
});

it("neither reads, motors nor edits a held body, and removes it when it is listed nowhere", async () => {
  const dog = createFauna("dog", 0, 0),
    other = createFauna("dog", 200, 0);
  const { s, tick } = await settled(dog, other);
  expect(tick([other], [nap(dog)])).toEqual({ reads: 0, motors: 0 });
  expect(s.diagnostics).toMatchObject({ bodies: 2, heldBodies: 1 });
  // An edit nobody announced waits for the nap to end.
  dog.position.wx = 50;
  tick([other], [dog]);
  expect(s.bodyState(dog.id)?.x).toBe(0);
  tick([other, dog]);
  expect(s.bodyState(dog.id)?.x).toBe(50);
  tick([other]);
  expect(s.diagnostics).toMatchObject({ bodies: 1, heldBodies: 0 });
});

it("wakes a held body the moment something runs into it", async () => {
  const player = createPlayer(0, 32),
    dog = createFauna("dog", 40, 32);
  const { s, tick } = await settled(player, dog);
  nap(dog);
  const x = dog.position.wx;
  const push = new Map([[player.id, { vx: 64, vy: 0 }]]);
  let ticks = 0;
  while (isNapping(dog) && ticks++ < 90) tick([player], [dog], push);
  expect(isNapping(dog)).toBe(false);
  // Read on the tick it woke, before its actor rejoins the live list.
  expect(dog.position.wx).not.toBe(x);
  expect(s.contactIds(dog.id)?.has(player.id)).toBe(true);
});

it("keeps a held pair's resting contact and the ground under held bodies", async () => {
  const a = createFauna("dog", 0, 0),
    b = createFauna("dog", 14, 0),
    far = createFauna("dog", 3000, 3000),
    rover = createFauna("dog", 600, 0);
  const { s, tick } = await settled(a, b, far, rover);
  const touching = !!s.contactIds(a.id)?.has(b.id);
  tick([rover], [a, b, far]);
  expect(!!s.contactIds(a.id)?.has(b.id)).toBe(touching);
  expect(!!s.contactIds(b.id)?.has(a.id)).toBe(touching);
  // The only live body leaves, so the static geometry is rebuilt. That wakes every
  // body in the solver; those the new ground did not move are put back to sleep
  // where they lay, unread, and their naps go on.
  for (const e of [a, b, far]) nap(e);
  const rebuilds = s.diagnostics.geometryRebuilds;
  teleportBody(rover, { wx: -4000, wy: -4000, wz: 0 });
  expect(tick([rover], [a, b, far]).reads).toBeLessThanOrEqual(1);
  expect(s.diagnostics.geometryRebuilds).toBe(rebuilds + 1);
  expect(tick([rover], [a, b, far]).reads).toBeLessThanOrEqual(1);
  for (let i = 0; i < 30; i++) tick([rover], [a, b, far]);
  for (const e of [a, b, far]) {
    expect(isNapping(e)).toBe(true);
    expect(s.bodyState(e.id)?.z).toBeCloseTo(0, 2);
  }
  for (let i = 0; i < 30; i++) tick([rover, a, b, far]);
  expect(far.wz).toBeCloseTo(0, 2);
});

it.each([1, 0.01, 0])(
  "lets a body fall when the rebuilt ground is no longer under it (gravity %s)",
  async (gravity) => {
    const dog = createFauna("dog", 0, 0),
      rover = createFauna("dog", 600, 0);
    const { s, tick } = await settled(dog, rover);
    nap(dog);
    tick([rover], [dog]);
    // The floor drops away under the sleeper: same sections, new revision.
    const pit: PhysicsGeometry = {
      ...ground,
      getHeight: () => -40,
      geometryVersion: () => ({ identity: ground, revision: 1 }),
    };
    s.synchronize([rover], undefined, [dog]);
    s.step(idle, pit, gravity);
    // Weak gravity moves it almost nothing in one step; it is falling all the same.
    expect(isNapping(dog)).toBe(false);
    // Without gravity it only floats, awake; it falls once gravity returns.
    const pull = gravity || 1;
    for (let i = 0; i < 120 / Math.sqrt(pull); i++) {
      s.synchronize([rover, dog]);
      s.step(idle, pit, pull);
    }
    expect(dog.wz).toBeLessThan(-20);
  },
);

it("puts an actor to sleep within a few ticks of its own motor stopping", async () => {
  const dog = createFauna("dog", 0, 0);
  const { s, tick } = await settled(dog);
  const walk = new Map([[dog.id, { vx: 40, vy: 0 }]]);
  for (let i = 0; i < 30; i++) tick([dog], [], walk);
  expect(dog.position.wx).toBeGreaterThan(10);
  // The solver alone keeps it awake, motored and read, for half a second and more.
  let ticks = 0;
  while (!s.restful(dog) && ticks < 60) {
    tick([dog]);
    ticks++;
  }
  expect(ticks).toBeLessThan(10);
  expect(tick([dog])).toEqual({ reads: 0, motors: 0 });
  expect(dog.velocity).toEqual({ vx: 0, vy: 0 });
});

it("leaves to the solver a still actor with another body in reach", async () => {
  const dog = createFauna("dog", 0, 32),
    other = createFauna("dog", 13, 32);
  const { s, tick } = await settled(dog, other);
  const nudge = new Map([[dog.id, { vx: 20, vy: 0 }]]);
  for (let i = 0; i < 6; i++) tick([dog, other], [], nudge);
  for (let i = 0; i < 20; i++) tick([dog, other]);
  // Pressed against its neighbour it is not put to sleep early.
  expect(s.contactIds(dog.id)?.has(other.id)).toBe(true);
  expect(s.restful(dog)).toBe(false);
});

it("wakes a sleeping actor before another lands on it, so the lander does not sink in", async () => {
  for (const held of [false, true]) {
    const low = createFauna("dog", 0, 0),
      top = createFauna("dog", 300, 0);
    const { s, tick } = await settled(low, top);
    const height = low.collider?.physicalHeight ?? 0;
    expect(s.restful(low)).toBe(true);
    if (held) nap(low);
    const step = () => (isNapping(low) && held ? tick([top], [low]) : tick([low, top]));
    teleportBody(top, { wx: 0, wy: 0, wz: height + 14 });
    let sunk = 0,
      landed = false;
    for (let i = 0; i < 40; i++) {
      step();
      if (top.jumpVZ !== undefined) continue;
      landed = true;
      sunk = Math.max(sunk, height - (top.wz ?? 0), -(low.wz ?? 0));
    }
    expect(landed).toBe(true);
    // Onto a sleeper left asleep the lander drives it a pixel into the ground.
    expect(sunk).toBeLessThan(0.2);
    expect(isNapping(low)).toBe(false);
  }
});

it("publishes an airborne body's height above the ground beneath it", async () => {
  const dog = createFauna("dog", 0, 0);
  const { tick } = await settled(dog);
  teleportBody(dog, { wx: 0, wy: 0, wz: 12 });
  tick([dog]);
  expect(dog.jumpVZ).toBeDefined();
  expect(dog.jumpZ).toBeGreaterThan(8);
  expect(dog.groundZ).toBeCloseTo(0, 0);
});

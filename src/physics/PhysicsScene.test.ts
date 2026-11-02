import { afterEach, expect, it } from "vitest";
import { getEntityAABB } from "../entities/collision.js";
import { createPlayer } from "../entities/Player.js";
import type { Prop } from "../entities/Prop.js";
import { createFauna } from "../wildlife/Fauna.js";
import { PHYSICS_DT } from "./PhysicsDefaults.js";
import { type MotionIntent, type PhysicsGeometry, PhysicsScene } from "./PhysicsScene.js";

const scenes: PhysicsScene[] = [];
afterEach(() => {
  for (const s of scenes.splice(0)) s.dispose();
});
async function scene() {
  const s = await PhysicsScene.create();
  scenes.push(s);
  return s;
}
function geometry(props: Prop[] = [], revision = 0): PhysicsGeometry {
  return {
    getCollision: () => 0,
    getHeight: () => 0,
    queryProps: () => props,
    geometryVersion: () => ({ identity: props, revision }),
  };
}
const idle = new Map<number, MotionIntent>();

it("advances all ordinary bodies once per tick and retains their collider identities", async () => {
  const s = await scene();
  const actors = Array.from({ length: 96 }, (_, i) => {
    const e = createFauna("dog", (i % 16) * 24, Math.floor(i / 16) * 18);
    e.id = i + 1;
    return e;
  });
  const ground = geometry();
  for (let i = 0; i < 60; i++) {
    s.synchronize(actors);
    s.step(idle, ground);
  }
  expect(s.diagnostics.worldSteps).toBe(60);
  expect(s.diagnostics.bodyCreates).toBe(96);
  const builds = s.diagnostics.geometryBuilds;
  s.synchronize(actors);
  s.step(idle, ground);
  expect(s.diagnostics.geometryBuilds).toBe(builds);
  expect(actors.every((e) => Math.abs(e.wz ?? Infinity) < 0.15)).toBe(true);
});

it("pushes an ordinary NPC and stops without retaining a runaway motor velocity", async () => {
  const s = await scene(),
    player = createPlayer(0, 32),
    npc = createFauna("dog", 18, 32);
  player.id = 1;
  npc.id = 2;
  const actors = [player, npc],
    ground = geometry();
  const right = new Map([[player.id, { vx: 64, vy: 0 }]]);
  for (let i = 0; i < 90; i++) {
    s.synchronize(actors);
    s.step(right, ground);
  }
  expect(npc.position.wx).toBeGreaterThan(35);
  const before = npc.position.wx;
  for (let i = 0; i < 60; i++) {
    s.synchronize(actors);
    s.step(idle, ground);
  }
  expect(npc.position.wx - before).toBeLessThan(2);
  expect(Math.abs(player.velocity?.vx ?? Infinity)).toBeLessThan(0.1);
  expect(Math.abs(npc.velocity?.vx ?? Infinity)).toBeLessThan(0.1);
});

it("lands on another body and walking across its head does not drag the lower body", async () => {
  const s = await scene(),
    lower = createPlayer(32, 32),
    upper = createPlayer(32, 32);
  lower.id = 1;
  upper.id = 2;
  upper.wz = 40;
  upper.jumpVZ = 0;
  const actors = [lower, upper],
    ground = geometry();
  for (let i = 0; i < 120; i++) {
    s.synchronize(actors);
    s.step(idle, ground);
  }
  expect(upper.wz).toBeCloseTo(12, 0);
  expect(upper.jumpVZ).toBeUndefined();
  const x = lower.position.wx,
    y = lower.position.wy;
  for (let i = 0; i < 12; i++) {
    s.synchronize(actors);
    s.step(new Map([[upper.id, { vx: 20, vy: 0 }]]), ground);
  }
  expect(Math.hypot(lower.position.wx - x, lower.position.wy - y)).toBeLessThan(0.1);
});

it("keeps jump ascent beside a body and does not re-trigger a held jump", async () => {
  const s = await scene(),
    a = createPlayer(0, 32),
    b = createPlayer(10, 32);
  a.id = 1;
  b.id = 2;
  const actors = [a, b],
    ground = geometry();
  for (let i = 0; i < 30; i++) {
    s.synchronize(actors);
    s.step(idle, ground);
  }
  let peak = 0;
  const input = new Map([[a.id, { vx: 32, vy: 0, jump: true }]]);
  for (let i = 0; i < 100; i++) {
    s.synchronize(actors);
    s.step(input, ground);
    peak = Math.max(peak, a.wz ?? 0);
  }
  expect(peak).toBeGreaterThan(18);
  expect(Math.abs(a.wz ?? Infinity)).toBeLessThan(0.15);
});

it("collides with compiled walls, applies an edit once and keeps the fixed player box", async () => {
  const s = await scene(),
    a = createPlayer(0, 32);
  a.id = 1;
  const actors = [a],
    base = geometry();
  let wall = true,
    version = 0;
  const source = {
    ...base,
    getCollision: (x: number) => (wall && x === 2 ? 1 : 0),
    geometryVersion: () => ({ identity: base, revision: version }),
  };
  const input = new Map([[a.id, { vx: 64, vy: 0 }]]);
  for (let i = 0; i < 90; i++) {
    s.synchronize(actors);
    s.step(input, source);
  }
  expect(
    getEntityAABB(a.position, a.collider ?? { width: 0, height: 0, offsetX: 0, offsetY: 0 }).right,
  ).toBeLessThan(32.2);
  wall = false;
  version++;
  for (let i = 0; i < 30; i++) {
    s.synchronize(actors);
    s.step(input, source);
  }
  expect(a.position.wx).toBeGreaterThan(45);
  expect(a.collider?.width).toBe(10);
  expect(s.diagnostics.bodyCreates).toBe(1);
});

it("uses gravity in the shared scene, including after snapshot restore", async () => {
  const a = createPlayer(0, 32);
  a.id = 1;
  const s = await scene(),
    ground = geometry();
  s.synchronize([a]);
  s.step(idle, ground);
  const start = s.snapshot();
  const jump = new Map([[a.id, { vx: 32, vy: 0, jump: true }]]);
  for (let i = 0; i < 10; i++) {
    s.synchronize([a]);
    s.step(jump, ground);
  }
  const expected = s.snapshot().bodies[0];
  const clone = createPlayer(0, 32);
  clone.id = 1;
  const other = await scene();
  other.synchronize([clone]);
  other.restore(start);
  for (let i = 0; i < 10; i++) {
    other.synchronize([clone]);
    other.step(jump, ground);
  }
  expect(clone.position.wx).toBeCloseTo(expected?.x ?? Infinity, 2);
  expect(clone.wz).toBeCloseTo(expected?.z ?? Infinity, 1);
  expect(other.diagnostics.worldSteps).toBe(10);
  expect(other.snapshot().tick).toBe(11);
  expect(PHYSICS_DT).toBe(1 / 60);
});

it("walks up a compiled ramp and retains empty space beneath an elevated deck", async () => {
  const ramp: Prop = {
    id: 100,
    type: "ramp",
    isProp: true,
    position: { wx: 32, wy: 32 },
    sprite: { sheetKey: "", frameCol: 0, frameRow: 0, spriteWidth: 64, spriteHeight: 32 },
    walls: null,
    collider: {
      offsetX: 0,
      offsetY: 0,
      width: 64,
      height: 32,
      surface: {
        id: "ramp",
        spaceId: "upper",
        z: 0,
        riseX: 24,
        riseY: 0,
        thickness: 2,
        connectsTo: [],
      },
    },
  };
  const deck: Prop = {
    ...ramp,
    id: 101,
    type: "deck",
    position: { wx: 96, wy: 32 },
    collider: {
      ...ramp.collider,
      offsetX: 0,
      offsetY: 0,
      width: 64,
      height: 32,
      surface: {
        id: "deck",
        spaceId: "upper",
        z: 24,
        riseX: 0,
        riseY: 0,
        thickness: 2,
        connectsTo: [],
      },
    },
  };
  const s = await scene(),
    a = createPlayer(10, 22);
  a.id = 1;
  a.wz = 6;
  const ground = geometry([ramp, deck]),
    right = new Map([[a.id, { vx: 32, vy: 0 }]]);
  for (let i = 0; i < 180; i++) {
    s.synchronize([a]);
    s.step(right, ground);
  }
  expect(a.position.wx).toBeGreaterThan(65);
  expect(a.wz).toBeGreaterThan(22);
  a.position.wx = 80;
  a.wz = 0;
  delete a.jumpVZ;
  for (let i = 0; i < 30; i++) {
    s.synchronize([a]);
    s.step(right, ground);
  }
  expect(a.position.wx).toBeGreaterThan(90);
  expect(Math.abs(a.wz ?? Infinity)).toBeLessThan(0.15);
});

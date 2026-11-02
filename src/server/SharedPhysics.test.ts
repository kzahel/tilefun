import { expect, it } from "vitest";
import { createBall } from "../entities/Ball.js";
import { getEntityAABB } from "../entities/collision.js";
import { ENTITY_FACTORIES } from "../entities/EntityFactories.js";
import { createPlayer } from "../entities/Player.js";
import { FLAT_SCENARIO } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { decodeServerMessage } from "../shared/binaryCodec.js";
import { PlayerSession } from "./PlayerSession.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
async function open() {
  const npc = ENTITY_FACTORIES.chicken?.(56, 32);
  if (!npc?.wanderAI) throw Error("Missing ordinary chicken");
  npc.wanderAI.timer = 100;
  const ball = createBall(32, 64);
  ball.wz = 24;
  ball.jumpVZ = 0;
  return ScenarioSession.create({
    version: 1,
    id: "shared-default",
    generation: FLAT_SCENARIO,
    player: createPlayer(16, 32),
    props: [],
    actors: [npc, ball],
  });
}

it("normal Realm startup advances player, NPC and ball with one shared integration", async () => {
  const s = await open();
  try {
    for (let i = 0; i < 90; i++) await s.step({ ...idle, dx: 1 });
    const npc = s.realm.entityManager.entities.find((e) => e.type === "chicken");
    const ball = s.realm.entityManager.entities.find((e) => e.type === "ball");
    expect(s.realm.collisionDiagnostics?.worldSteps).toBe(90);
    expect(s.realm.collisionDiagnostics?.bodyCreates).toBe(3);
    const wire = s.frames()[0];
    if (!wire) throw Error("Missing normal frame");
    const frame = decodeServerMessage(wire);
    if (frame.type !== "frame") throw Error("Expected normal frame");
    expect(frame.physics?.tick).toBe(90);
    expect(frame.physics?.bodies).toHaveLength(3);
    expect(frame.physics?.omitted).toBe(0);
    expect(npc?.position.wx).toBeGreaterThan(65);
    expect(npc?.desiredVelocity?.vx).toBe(0);
    expect(Math.abs(ball?.wz ?? Infinity)).toBeLessThan(2);
    const before = npc?.position.wx ?? 0;
    for (let i = 0; i < 30; i++) await s.step(idle);
    expect((npc?.position.wx ?? Infinity) - before).toBeLessThan(2);
  } finally {
    await s.close();
  }
});

it("packet bursts cannot add player travel or extra world integration; short gaps retain controls", async () => {
  const s = await open();
  try {
    await s.ready();
    const p = s.player.player,
      start = p.position.wx;
    s.realm.handleMessage(s.player.clientId, s.player, {
      type: "player-input",
      ...idle,
      dx: 1,
      seq: 100,
    });
    s.realm.handleMessage(s.player.clientId, s.player, {
      type: "player-input",
      ...idle,
      dx: 1,
      seq: 101,
    });
    s.tick(1 / 60);
    expect(p.position.wx - start).toBeGreaterThan(0.5);
    expect(p.position.wx - start).toBeLessThan(1.2);
    expect(s.realm.collisionDiagnostics?.worldSteps).toBe(1);
    expect(s.player.lastProcessedInputSeq).toBe(101);
    s.tick(1 / 60);
    expect(p.position.wx - start).toBeGreaterThan(1.5);
    expect(s.realm.collisionDiagnostics?.worldSteps).toBe(2);
  } finally {
    await s.close();
  }
});

it("ordinary player can land and walk on an NPC without dragging it", async () => {
  const s = await open();
  try {
    await s.step(idle);
    const npc = s.realm.entityManager.entities.find((e) => e.type === "chicken");
    if (!npc) throw Error("Missing NPC");
    const p = s.player.player;
    p.position = { ...npc.position };
    p.wz = 30;
    p.jumpVZ = 0;
    for (let i = 0; i < 90; i++) await s.step(idle);
    expect(p.wz).toBeCloseTo(8, 0);
    expect(p.jumpVZ).toBeUndefined();
    const anchor = { ...npc.position };
    for (let i = 0; i < 4; i++) await s.step({ ...idle, dx: 1 });
    expect(Math.hypot(npc.position.wx - anchor.wx, npc.position.wy - anchor.wy)).toBeLessThan(0.2);
  } finally {
    await s.close();
  }
});

it("another session shares the same world step and reload reconstructs semantic bodies", async () => {
  const s = await open();
  try {
    const guest = new PlayerSession("second");
    guest.editorEnabled = false;
    await s.realm.addPlayer(guest);
    guest.visibleRange = { ...s.player.visibleRange };
    guest.player.position = { wx: 16, wy: 96 };
    await s.step(idle);
    expect(s.realm.collisionDiagnostics?.worldSteps).toBe(1);
    expect(s.realm.collisionDiagnostics?.bodies).toBe(4);
    await s.realm.removePlayer(guest.clientId);
    await s.reload();
    await s.step(idle);
    expect(s.realm.collisionDiagnostics?.worldSteps).toBe(1);
    expect(s.realm.collisionDiagnostics?.bodies).toBe(3);
  } finally {
    await s.close();
  }
});

it("drives a normal car through the shared scene and persists its committed pose", async () => {
  const s = await ScenarioSession.create({
    version: 1,
    id: "shared-car",
    generation: FLAT_SCENARIO,
    player: createPlayer(-64, 64),
    props: [],
    parkedVehicles: [{ model: "compact-1", wx: 64, wy: 64, facing: 3 }],
  });
  try {
    const car = s.realm.entityManager.entities.find((e) => e.type === "vehicle-v1:compact-1");
    if (!car?.collider) throw Error("Missing car");
    const box = getEntityAABB(car.position, car.collider);
    await s.command({ kind: "teleport", position: { wx: box.left - 12, wy: car.position.wy } });
    await s.command({ kind: "enter-vehicle", entityId: car.id });
    for (let i = 0; i < 60; i++) await s.step({ ...idle, dx: 1 });
    expect(car.position.wx).toBeGreaterThan(140);
    expect(s.realm.collisionDiagnostics?.worldSteps).toBe(60);
    expect(s.realm.collisionDiagnostics?.bodyCreates).toBe(1);
    await s.command({ kind: "exit-vehicle" });
    const expected = car.position.wx;
    await s.reload();
    const restored = s.realm.entityManager.entities.find((e) => e.type === car.type);
    expect(restored?.position.wx).toBeCloseTo(expected, 2);
  } finally {
    await s.close();
  }
});

it("AI decisions supply intent while shared readback, removal and reload own the body", async () => {
  const s = await open();
  try {
    const npc = s.realm.entityManager.entities.find((e) => e.type === "chicken");
    if (!npc?.wanderAI) throw Error("Missing chicken");
    npc.position = { wx: 128, wy: 128 };
    npc.wanderAI.state = "walking";
    npc.wanderAI.dirX = 1;
    npc.wanderAI.dirY = 0;
    const start = npc.position.wx;
    for (let i = 0; i < 60; i++) await s.step(idle);
    expect(npc.position.wx - start).toBeGreaterThan(15);
    expect(npc.desiredVelocity?.vx).toBeGreaterThan(0);
    expect(npc.velocity?.vx).toBeCloseTo(npc.desiredVelocity?.vx ?? Infinity, 1);
    npc.wanderAI.state = "idle";
    for (let i = 0; i < 12; i++) await s.step(idle);
    expect(npc.desiredVelocity?.vx).toBe(0);
    expect(Math.abs(npc.velocity?.vx ?? Infinity)).toBeLessThan(0.1);
    const savedX = npc.position.wx;
    await s.reload();
    const restored = s.realm.entityManager.entities.find((e) => e.type === "chicken");
    expect(restored?.position.wx).toBeCloseTo(savedX, 2);
    if (!restored) throw Error("Missing restored chicken");
    s.realm.entityManager.remove(restored.id);
    await s.step(idle);
    expect(s.realm.physicsState?.bodies.some((b) => b.id === restored.id)).toBe(false);
  } finally {
    await s.close();
  }
});

it("admits an explicit ball launch and removes a settled unowned ball through gameplay lifetime", async () => {
  const s = await open();
  try {
    await s.step(idle);
    const ball = s.realm.entityManager.entities.find((e) => e.type === "ball");
    if (!ball?.velocity) throw Error("Missing ball");
    const x = ball.position.wx;
    ball.velocity.vx = 100;
    await s.step(idle);
    expect(ball.position.wx - x).toBeGreaterThan(1);
    ball.position = { wx: 100, wy: 100 };
    ball.wz = 0;
    ball.jumpVZ = 0;
    ball.velocity.vx = ball.velocity.vy = 0;
    for (let i = 0; i < 240; i++) await s.step(idle);
    expect(s.realm.entityManager.byId.has(ball.id)).toBe(false);
  } finally {
    await s.close();
  }
});

it("ordinary shared ball contacts trigger NPC reactions without a separate bounce integrator", async () => {
  const s = await open();
  try {
    const ball = s.realm.entityManager.entities.find((entity) => entity.type === "ball");
    const npc = s.realm.entityManager.entities.find((entity) => entity.type === "chicken");
    if (!ball || !npc) throw Error("Missing contact fixture");
    ball.position = { wx: 48, wy: 32 };
    ball.wz = 0;
    ball.velocity = { vx: 120, vy: 0 };
    for (let tick = 0; tick < 8; tick++) await s.step(idle);
    expect(npc.wanderAI?.state).toBe("scared");
    expect(npc.wanderAI?.scaredTimer).toBeGreaterThan(0);
    expect(ball.position.wx).toBeLessThan(npc.position.wx);
  } finally {
    await s.close();
  }
});

import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { PlayerPredictor } from "../client/PlayerPredictor.js";
import { createBall } from "../entities/Ball.js";
import { EntityManager } from "../entities/EntityManager.js";
import { createPlayer } from "../entities/Player.js";
import { PropManager } from "../entities/PropManager.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import { decodeActor, encodeActor } from "../persistence/ActorRecords.js";
import { tickBallPhysics } from "../physics/BallPhysics.js";
import {
  getMovementPhysicsParams,
  stepPlayerFromInput,
  tickJumpGravity,
} from "../physics/PlayerMovement.js";
import { createMovementContext } from "../physics/SimulationEnvironment.js";
import { FLAT_SCENARIO } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { decodeServerMessage, encodeServerMessage } from "../shared/binaryCodec.js";
import { applyEntityDelta, diffEntitySnapshots } from "../shared/entityDelta.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import { World } from "../world/World.js";
import { createMallard, MALLARD_TYPE } from "./Mallard.js";
import { updateMallardAI } from "./mallardAI.js";
import { MALLARD_BOUNCE_VZ, startleMallard } from "./mallardInteractions.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
const open = { canOccupy: () => true, isWater: () => false, surfaceZ: () => 0 };
const physics = getMovementPhysicsParams();
it("replicates the alarm state through both binary baselines and deltas", () => {
  const d = createMallard(64, 64),
    before = serializeEntity(d);
  startleMallard(d, { wx: 40, wy: 64 });
  const after = serializeEntity(d);
  const wire = decodeServerMessage(
    encodeServerMessage({
      type: "frame",
      serverTick: 1,
      lastProcessedInputSeq: 0,
      playerEntityId: 0,
      entityBaselines: [after],
      entityDeltas: [required(diffEntitySnapshots(before, after))],
    }),
  );
  if (wire.type !== "frame") throw new Error("Expected frame");
  expect(deserializeEntity(required(wire.entityBaselines?.[0])).wanderAI?.state).toBe("scared");
  const replica = deserializeEntity(before);
  applyEntityDelta(replica, required(wire.entityDeltas?.[0]));
  expect(replica.wanderAI?.state).toBe("scared");
  expect(replica.sprite?.clip).toBe(4);
});
function fallingPlayer() {
  const player = createPlayer(64, 64);
  player.id = 100;
  player.wz = 12;
  player.jumpVZ = -40;
  player.jumpZ = 12;
  return player;
}

it("predicts body blocking and the same landing bounce from replicated duck bodies", () => {
  const duck = createMallard(64, 64);
  duck.id = 1;
  duck.wz = 0;
  const player = fallingPlayer();
  const replica = deserializeEntity(serializeEntity(duck));
  const world = new World(new FlatStrategy());
  // Load the neighborhood used by client-side shared physics.
  for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) world.chunks.getOrCreate(x, y);
  const predictor = new PlayerPredictor();
  predictor.reset(player);
  const ctx = createMovementContext({
    movingEntity: player,
    excludeIds: new Set([player.id]),
    noclip: false,
    getCollision: () => 0,
    getHeight: () => 0,
    queryEntities: () => [duck],
    queryProps: () => [],
  });
  const result = stepPlayerFromInput(
    player,
    idle,
    0.1,
    ctx,
    () => 0,
    () => ({ props: [], entities: [duck] }),
    { jumpConsumed: false, lastJumpHeld: false },
    physics,
  );
  predictor.update(0.1, idle, world, [], [replica]);
  expect(result.outcome.wildlifeContactId).toBe(duck.id);
  expect(result.outcome.enteredWater).toBe(false);
  expect(player.jumpVZ).toBe(MALLARD_BOUNCE_VZ);
  expect(predictor.player?.wz).toBeCloseTo(required(player.wz), 5);
  expect(predictor.player?.jumpVZ).toBe(player.jumpVZ);
  expect(ctx.isEntityBlocked({ left: 62, right: 66, top: 62, bottom: 66 })).toBe(false); // above the duck now
  player.wz = 0;
  expect(ctx.isEntityBlocked({ left: 62, right: 66, top: 62, bottom: 66 })).toBe(true);
});

it("does not bounce on a near miss, an ascending pass or a body above the player", () => {
  for (const kind of ["miss", "ascending", "above"] as const) {
    const p = fallingPlayer(),
      d = createMallard(64, 64);
    d.id = 1;
    if (kind === "miss") d.position.wx += 40;
    if (kind === "ascending") p.jumpVZ = 80;
    if (kind === "above") d.wz = 40;
    expect(tickJumpGravity(p, 0.1, () => 0, physics, [], [d]).wildlifeContactId).toBeUndefined();
  }
});

it("balls bounce and startle ducks without losing the reaction to custom AI; elevated balls miss", () => {
  for (const z of [0, 30]) {
    const manager = new EntityManager(),
      d = manager.spawn(createMallard(64, 64)),
      b = manager.spawn(createBall(60, 64));
    b.wz = z;
    if (z > 0) {
      b.jumpZ = z;
      b.jumpVZ = 0;
    }
    required(b.velocity).vx = 100;
    tickBallPhysics(
      manager,
      0.01,
      () => 0,
      () => 0,
    );
    if (z > 0) {
      expect(d.mallard?.state).toBe("rest");
      expect(b.velocity?.vx).toBeGreaterThan(0);
      continue;
    }
    expect(b.velocity?.vx).toBeLessThan(0);
    expect(d.mallard?.state).toBe("startle");
    updateMallardAI(d, 0.1, open, [d], []);
    expect(d.mallard?.state).toBe("startle");
    expect(d.wanderAI?.state).toBe("scared");
    expect(d.deathTimer).toBeUndefined();
    expect(startleMallard(d, { wx: 0, wy: 0 })).toBe(false);
  }
});

it("bounds escape flight, restores its exact saved arc, and settles without teleporting through a new obstruction", () => {
  const manager = new EntityManager(),
    d = manager.spawn(createMallard(64, 64)),
    props = new PropManager();
  startleMallard(d, { wx: 40, wy: 64 });
  updateMallardAI(d, 0.65, open, [d], []);
  expect(d.mallard?.state).toBe("flight");
  manager.update(
    0.3,
    () => 0,
    [],
    props,
    undefined,
    () => 0,
  );
  expect(d.wz).toBeGreaterThan(0);
  expect(d.sprite?.clip).toBe(5);
  const restored = decodeActor(encodeActor(d));
  if ("isProp" in restored) throw new Error("Expected duck");
  const other = new EntityManager();
  other.spawn(restored);
  manager.update(
    0.1,
    () => 0,
    [],
    props,
    undefined,
    () => 0,
  );
  other.update(
    0.1,
    () => 0,
    [],
    props,
    undefined,
    () => 0,
  );
  expect(restored.mallard).toEqual(d.mallard);
  expect(restored.position).toEqual(d.position);
  expect(restored.wz).toBe(d.wz);
  const before = { ...restored.position };
  // Terrain introduced during flight blocks further movement, not a teleport on landing.
  for (let i = 0; i < 30; i++)
    other.update(
      0.1,
      () => 1,
      [],
      props,
      undefined,
      () => 0,
    );
  expect(restored.position).toEqual(before);
  expect(restored.wz).toBe(0);
  expect(restored.mallard?.state).toBe("recover");
  expect(Math.hypot(d.position.wx - 64, d.position.wy - 64)).toBeLessThanOrEqual(160);
});

it("quacks and settles in place when no safe escape exists", () => {
  const d = createMallard(64, 64);
  startleMallard(d, { wx: 50, wy: 64 });
  updateMallardAI(d, 0.65, { ...open, canOccupy: () => false }, [d], []);
  expect(d.mallard?.state).toBe("recover");
  expect(d.position).toEqual({ wx: 64, wy: 64 });
  updateMallardAI(d, 2.1, open, [d], []);
  expect(d.mallard?.state).toBe("rest");
});

it("a real throw clears its owner, hits a duck, and preserves the duck through escape", async () => {
  const s = await ScenarioSession.create({
    version: 1,
    id: "duck-ball",
    generation: FLAT_SCENARIO,
    player: createPlayer(64, 64),
    props: [],
    actors: [createMallard(144, 64)],
  });
  try {
    s.realm.handleMessage(s.player.clientId, s.player, {
      type: "throw-ball",
      dirX: 1,
      dirY: 0,
      force: 0,
    });
    await s.step(idle, 1 / 60);
    expect(s.player.player.velocity?.vx).toBe(0);
    const states = new Set<string>();
    const duck = required(s.realm.entityManager.entities.find((e) => e.type === MALLARD_TYPE));
    for (let i = 0; i < 260; i++) {
      await s.step(idle, 1 / 60);
      states.add(required(duck.mallard).state);
    }
    expect(states.has("startle")).toBe(true);
    expect(states.has("flight")).toBe(true);
    expect(states.has("recover")).toBe(true);
    expect(duck.deathTimer).toBeUndefined();
  } finally {
    await s.close();
  }
});

it.each([true, false])(
  "real Realm landing triggers one bounded escape and retains identity (input=%s)",
  async (input) => {
    const d = createMallard(64, 64);
    d.persistentId = "test-durable-duck";
    const s = await ScenarioSession.create({
      version: 1,
      id: "duck-contact",
      generation: FLAT_SCENARIO,
      player: fallingPlayer(),
      props: [],
      actors: [d],
    });
    try {
      const duck = () =>
        required(s.realm.entityManager.entities.find((e) => e.type === MALLARD_TYPE));
      for (let i = 0; i < 8; i++) {
        if (input) await s.step(idle, 1 / 60);
        else s.tick(1 / 60);
      }
      expect(s.player.player.jumpVZ).toBeGreaterThan(0);
      expect(duck().mallard?.state).toBe("startle");
      const id = duck().persistentId;
      for (let i = 0; i < 60; i++) await s.step(idle, 1 / 60);
      expect(duck().mallard?.state).toBe("flight");
      expect(duck().wz).toBeGreaterThan(0);
      const saved = encodeActor(duck());
      await s.reload();
      expect(duck().persistentId).toBe(id);
      expect(duck().mallard).toEqual(saved.state.mallard);
      for (let i = 0; i < 210; i++) await s.step(idle, 1 / 60);
      expect(duck().mallard?.state).not.toBe("flight");
      expect(duck().wz).toBe(0);
      expect(duck().persistentId).toBe(id);
      expect(duck().deathTimer).toBeUndefined();
    } finally {
      await s.close();
    }
  },
);

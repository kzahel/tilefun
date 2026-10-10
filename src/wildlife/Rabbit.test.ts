import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { TerrainId } from "../autotile/TerrainId.js";
import { PlayerPredictor } from "../client/PlayerPredictor.js";
import { createBall } from "../entities/Ball.js";
import { aabbOverlapsPropWalls, getEntityAABB } from "../entities/collision.js";
import { EntityManager } from "../entities/EntityManager.js";
import { createPlayer } from "../entities/Player.js";
import { createProp } from "../entities/PropFactories.js";
import { PropManager } from "../entities/PropManager.js";
import { setSpriteClipElapsed } from "../entities/spriteAnimation.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import { createDescriptor } from "../generation/GenerationDescriptor.js";
import { createGenerator } from "../generation/Generator.js";
import { NaturalLandscape } from "../generation/regional/NaturalLandscape.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { decodeActor, encodeActor } from "../persistence/ActorRecords.js";
import { tickBallPhysics } from "../physics/BallPhysics.js";
import { getMovementPhysicsParams, stepPlayerFromInput } from "../physics/PlayerMovement.js";
import { createMovementContext } from "../physics/SimulationEnvironment.js";
import { naturalLandscapeRecipe } from "../scenarios/NaturalLandscapeRecipe.js";
import { FLAT_SCENARIO } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { decodeServerMessage, encodeServerMessage } from "../shared/binaryCodec.js";
import { applyEntityDelta, diffEntitySnapshots } from "../shared/entityDelta.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import { World } from "../world/World.js";
import { createRabbit, RABBIT_CLIPS, RABBIT_IMAGE, RABBIT_TYPE } from "./Rabbit.js";
import { updateRabbitAI } from "./rabbitAI.js";
import { startleRabbit } from "./rabbitInteractions.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
const open = { canOccupy: () => true, isWater: () => false, surfaceZ: () => 0 };

it("uses the unchanged rabbit sheet and its native hop/action frame ranges", () => {
  const sprite = JSON.parse(
    readFileSync(`public/${RABBIT_IMAGE.replace("sheet.png", "sprite.json")}`, "utf8"),
  );
  expect(
    createHash("sha256")
      .update(readFileSync(`public/${RABBIT_IMAGE}`))
      .digest("hex"),
  ).toBe(sprite.sheetSha256);
  expect(sprite.anchor).toEqual([16, 24]);
  for (const clip of RABBIT_CLIPS) {
    expect(sprite.clips[clip.name].start).toBe(clip.start);
    expect(sprite.clips[clip.name].count).toBe(clip.count);
    expect(clip.frameDuration).toBe(1000 / sprite.fps);
  }
});

it("seeds small durable groups in dry glades beside woodland, independent of chunk order", () => {
  const coords = Array.from({ length: 16 }, (_, i) => ({
    cx: -12 + (i % 4),
    cy: -36 + Math.floor(i / 4),
  }));
  const placements = (seed: number, reverse = false) => {
    const n = new NaturalLandscape(regionalWorld(seed), "thicket");
    return (reverse ? [...coords].reverse() : coords)
      .flatMap((c) => n.wildlife(c.cx, c.cy))
      .filter((p) => p.type === RABBIT_TYPE)
      .sort((a, b) => a.featureId.localeCompare(b.featureId));
  };
  const rabbits = placements(2026);
  expect(rabbits.length).toBeGreaterThanOrEqual(2);
  expect(rabbits.length).toBeLessThanOrEqual(3);
  expect(placements(2026, true)).toEqual(rabbits);
  expect(placements(7)).not.toEqual(rabbits);
  const generator = createGenerator(createDescriptor("regional", 2026));
  const n = new NaturalLandscape(regionalWorld(2026), "thicket");
  for (const p of rabbits) {
    expect(n.pondBank(p.wx / 16, p.wy / 16)).toBe(false);
    expect(n.terrain(p.wx / 16, p.wy / 16)).toBe(TerrainId.Grass);
    expect(n.inThicket(p.wx / 16, p.wy / 16)).toBe(false);
    const cx = Math.floor(p.wx / 256),
      cy = Math.floor(p.wy / 256);
    expect(generator.actors?.(cx, cy)).toContainEqual(p);
    const nearby = [-1, 0, 1].flatMap((dx) =>
      [-1, 0, 1].flatMap((dy) => generator.placements(cx + dx, cy + dy, new Set()).placements),
    );
    // The whole home circle, not just each initial spawn, is clear dry ground.
    const ai = required(p.rabbit);
    for (let i = 0; i < 16; i++) {
      const angle = (i * Math.PI) / 8;
      const point = {
        wx: ai.home.wx + Math.cos(angle) * ai.radius,
        wy: ai.home.wy + Math.sin(angle) * ai.radius,
      };
      expect(n.terrain(point.wx / 16, point.wy / 16)).toBe(TerrainId.Grass);
      const box = getEntityAABB(point, required(createRabbit(point.wx, point.wy).collider));
      expect(
        nearby.some((a) => {
          const prop = createProp(a.propType, a.wx, a.wy);
          return aabbOverlapsPropWalls(box, prop.position, prop);
        }),
      ).toBe(false);
    }
  }
  for (let i = 0; i < 140; i++) n.rabbitGlade(i, -9);
  expect(n.cacheSizes.glades).toBeLessThanOrEqual(128);
});

it("hops with a stationary push, physical flight and landing recovery; reload continues the same arc", () => {
  const manager = new EntityManager(),
    props = new PropManager();
  const rabbit = manager.spawn(createRabbit(64, 64));
  required(rabbit.rabbit).timer = 0;
  updateRabbitAI(rabbit, 0.1, open, [rabbit], []);
  expect(rabbit.rabbit?.state).toBe("hop");
  manager.update(
    0.2,
    () => 0,
    [],
    props,
    undefined,
    () => 0,
  );
  expect(rabbit.position).toEqual({ wx: 64, wy: 64 });
  expect(rabbit.wz).toBe(0);
  manager.update(
    0.3,
    () => 0,
    [],
    props,
    undefined,
    () => 0,
  );
  expect(rabbit.wz).toBeGreaterThan(4);
  expect(rabbit.position).not.toEqual({ wx: 64, wy: 64 });
  expect(rabbit.sprite?.frameCol).toBe(5);
  const restored = decodeActor(encodeActor(rabbit));
  if ("isProp" in restored) throw new Error("Expected rabbit");
  expect(restored.sprite?.frameCol).toBe(rabbit.sprite?.frameCol);
  const other = new EntityManager();
  other.spawn(restored);
  for (let i = 0; i < 8; i++) {
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
    expect(restored.position).toEqual(rabbit.position);
    expect(restored.wz).toBe(rabbit.wz);
    expect(restored.rabbit).toEqual(rabbit.rabbit);
  }
  expect(rabbit.rabbit?.state).toBe("rest");
  expect(rabbit.wz).toBe(0);
});

it("replicates mid-hop phase through binary baselines/deltas and removes it on landing", () => {
  const rabbit = createRabbit(64, 64);
  required(rabbit.rabbit).timer = 0;
  const before = serializeEntity(rabbit);
  updateRabbitAI(rabbit, 0.1, open, [rabbit], []);
  setSpriteClipElapsed(rabbit, 437);
  const after = serializeEntity(rabbit);
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
  const baseline = deserializeEntity(required(wire.entityBaselines?.[0]));
  expect(baseline.sprite?.frameCol).toBe(4);
  const replica = deserializeEntity(before);
  applyEntityDelta(replica, required(wire.entityDeltas?.[0]));
  expect(replica.sprite?.clipElapsedMs).toBe(437);
  expect(replica.sprite?.frameCol).toBe(4);
  delete required(rabbit.sprite).clipElapsedMs;
  applyEntityDelta(replica, required(diffEntitySnapshots(after, serializeEntity(rabbit))));
  expect(replica.sprite?.clipElapsedMs).toBeUndefined();
});

it("balls ricochet and startle rabbits; elevated balls miss and repeated alarms keep the escape intact", () => {
  for (const z of [0, 30]) {
    const manager = new EntityManager(),
      rabbit = manager.spawn(createRabbit(64, 64));
    const ball = manager.spawn(createBall(61, 64));
    ball.wz = z;
    if (z) {
      ball.jumpZ = z;
      ball.jumpVZ = 0;
    }
    required(ball.velocity).vx = 100;
    tickBallPhysics(
      manager,
      0.01,
      () => 0,
      () => 0,
    );
    expect(rabbit.rabbit?.state).toBe(z ? "rest" : "startle");
    if (z) continue;
    expect(ball.velocity?.vx).toBeLessThan(0);
    expect(startleRabbit(rabbit, { wx: 0, wy: 0 })).toBe(false);
    updateRabbitAI(rabbit, 0.3, open, [rabbit], []);
    expect(rabbit.rabbit?.state).toBe("hop");
    expect(rabbit.wanderAI?.state).toBe("scared");
    expect(rabbit.deathTimer).toBeUndefined();
  }
});

it("lands and stands on a replicated rabbit body until Jump is pressed", () => {
  const rabbit = createRabbit(64, 64);
  rabbit.id = 1;
  const player = createPlayer(64, 64);
  player.id = 100;
  player.wz = 10;
  player.jumpZ = 10;
  player.jumpVZ = -40;
  const world = new World(new FlatStrategy());
  for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) world.chunks.getOrCreate(x, y);
  const predictor = new PlayerPredictor();
  predictor.reset(player);
  const ctx = createMovementContext({
    movingEntity: player,
    excludeIds: new Set([player.id]),
    noclip: false,
    getCollision: () => 0,
    getHeight: () => 0,
    queryEntities: () => [rabbit],
    queryProps: () => [],
  });
  const result = stepPlayerFromInput(
    player,
    idle,
    0.05,
    ctx,
    () => 0,
    () => ({ props: [], entities: [rabbit] }),
    { jumpConsumed: false, lastJumpHeld: false },
    getMovementPhysicsParams(),
  );
  predictor.update(0.05, idle, world, [], [deserializeEntity(serializeEntity(rabbit))]);
  expect(result.outcome.wildlifeContactId).toBe(rabbit.id);
  expect(player.jumpVZ).toBeUndefined();
  expect(player.jumpZ).toBeUndefined();
  expect(player.wz).toBe(8);
  expect(predictor.player?.wz).toBeCloseTo(required(player.wz), 5);
  expect(predictor.player?.jumpVZ).toBe(player.jumpVZ);
  // A stationary body remains support across idle ticks, with no repeated contact/jump.
  let jumpState = { jumpConsumed: false, lastJumpHeld: false };
  for (let i = 0; i < 90; i++) {
    const step = stepPlayerFromInput(
      player,
      idle,
      1 / 60,
      ctx,
      () => 0,
      () => ({ props: [], entities: [rabbit] }),
      jumpState,
      getMovementPhysicsParams(),
    );
    jumpState = step.jumpState;
    predictor.update(1 / 60, idle, world, [], [deserializeEntity(serializeEntity(rabbit))]);
    expect(step.outcome.wildlifeContactId).toBeUndefined();
    expect(player.wz).toBe(8);
    expect(player.jumpVZ).toBeUndefined();
    expect(predictor.player?.wz).toBe(8);
    expect(predictor.player?.jumpVZ).toBeUndefined();
  }
  stepPlayerFromInput(
    player,
    { ...idle, jump: true },
    1 / 60,
    ctx,
    () => 0,
    () => ({ props: [], entities: [rabbit] }),
    jumpState,
    getMovementPhysicsParams(),
  );
  predictor.update(
    1 / 60,
    { ...idle, jump: true },
    world,
    [],
    [deserializeEntity(serializeEntity(rabbit))],
  );
  expect(player.jumpVZ).toBeGreaterThan(0);
  expect(predictor.player?.jumpVZ).toBeCloseTo(required(player.jumpVZ), 5);
});

it("recovers in a closed habitat and lands at the actual position if new terrain blocks a hop", () => {
  const rabbit = createRabbit(64, 64);
  startleRabbit(rabbit, { wx: 40, wy: 64 });
  updateRabbitAI(rabbit, 0.3, { ...open, canOccupy: () => false }, [rabbit], []);
  expect(rabbit.rabbit?.state).toBe("recover");
  updateRabbitAI(rabbit, 2.6, open, [rabbit], []);
  expect(rabbit.rabbit?.state).toBe("rest");
  startleRabbit(rabbit, { wx: 40, wy: 64 });
  updateRabbitAI(rabbit, 0.3, open, [rabbit], []);
  const manager = new EntityManager();
  manager.spawn(rabbit);
  for (let i = 0; i < 15; i++)
    manager.update(
      0.1,
      () => CollisionFlag.Solid,
      [],
      new PropManager(),
      undefined,
      () => 0,
    );
  expect(rabbit.position).toEqual({ wx: 64, wy: 64 });
  expect(rabbit.wz).toBe(0);
  expect(rabbit.rabbit?.state).toBe("recover");
});

it("runs all native cycles on dry ground in the production Realm and retains saved individuals/deletions", async () => {
  const s = await ScenarioSession.create(naturalLandscapeRecipe("rabbits", "thicket"));
  try {
    const rabbits = () => s.realm.entityManager.entities.filter((e) => e.type === RABBIT_TYPE);
    expect(rabbits().length).toBeGreaterThanOrEqual(2);
    const clips = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      await s.step(idle, 0.1);
      for (const rabbit of rabbits()) {
        clips.add(rabbit.sprite?.clip ?? 0);
        expect(
          s.realm.world.getCollisionIfLoaded(
            Math.floor(rabbit.position.wx / 16),
            Math.floor(rabbit.position.wy / 16),
          ) & CollisionFlag.Water,
        ).toBe(0);
        expect(
          Math.hypot(
            rabbit.position.wx - required(rabbit.rabbit).home.wx,
            rabbit.position.wy - required(rabbit.rabbit).home.wy,
          ),
        ).toBeLessThanOrEqual(required(rabbit.rabbit).radius + 1);
      }
    }
    expect([...clips].sort()).toEqual([0, 1, 2]);
    const removed = required(rabbits()[0]),
      retained = required(rabbits()[1]);
    s.realm.entityManager.remove(removed.id);
    const manual = s.realm.entityManager.spawn(
      createRabbit(s.player.player.position.wx + 24, s.player.player.position.wy),
    );
    const saved = encodeActor(retained),
      manualId = manual.persistentId;
    await s.reload();
    expect(rabbits().some((r) => r.persistentId === removed.persistentId)).toBe(false);
    const restored = required(rabbits().find((r) => r.persistentId === saved.persistentId));
    expect(restored.rabbit).toEqual(saved.state.rabbit);
    expect(restored.position).toEqual({ wx: saved.wx, wy: saved.wy });
    expect(rabbits().some((r) => r.persistentId === manualId)).toBe(true);
  } finally {
    await s.close();
  }
}, 60000);

it.each([true, false])(
  "Realm landing startles a rabbit with or without player input (input=%s)",
  async (input) => {
    const rabbit = createRabbit(64, 64);
    rabbit.persistentId = "durable-rabbit";
    const player = createPlayer(64, 64);
    player.wz = 11;
    player.jumpZ = 11;
    player.jumpVZ = -40;
    const s = await ScenarioSession.create({
      version: 1,
      id: "rabbit-contact",
      generation: FLAT_SCENARIO,
      player,
      props: [],
      actors: [rabbit],
    });
    try {
      for (let i = 0; i < 6; i++) {
        if (input) await s.step(idle, 1 / 60);
        else s.tick(1 / 60);
      }
      const animal = required(s.realm.entityManager.entities.find((e) => e.type === RABBIT_TYPE));
      expect(s.player.player.jumpVZ).toBeUndefined();
      expect(animal.wanderAI?.state).toBe("scared");
      for (let i = 0; i < 22; i++) await s.step(idle, 1 / 60);
      expect(animal.rabbit?.state).toBe("hop");
      const saved = encodeActor(animal);
      await s.reload();
      const restored = required(s.realm.entityManager.entities.find((e) => e.type === RABBIT_TYPE));
      expect(restored.persistentId).toBe("durable-rabbit");
      expect(restored.rabbit).toEqual(saved.state.rabbit);
    } finally {
      await s.close();
    }
  },
);

it("avoids water, rejects escape routes toward a threat and favors accessible cover", () => {
  const targets = [];
  for (const shelterY of [-64, 192]) {
    const rabbit = createRabbit(64, 64),
      ai = required(rabbit.rabbit);
    ai.shelter = { wx: 128, wy: shelterY };
    startleRabbit(rabbit, { wx: 40, wy: 64 });
    updateRabbitAI(rabbit, 0.2, { ...open, isWater: (p) => p.wx < 64 }, [rabbit], []);
    expect(ai.state).toBe("hop");
    expect(ai.target.wx).toBeGreaterThan(64);
    expect(Math.hypot(ai.target.wx - 40, ai.target.wy - 64)).toBeGreaterThan(32);
    targets.push(ai.target.wy);
  }
  expect(required(targets[0])).toBeLessThan(required(targets[1]));
  const rabbit = createRabbit(64, 64);
  startleRabbit(rabbit, { wx: 40, wy: 64 });
  updateRabbitAI(rabbit, 0.2, { ...open, isWater: () => true }, [rabbit], []);
  expect(rabbit.rabbit?.state).toBe("recover");
});

it("finishes a routine hop before a newly triggered escape, without restarting airborne motion", () => {
  const manager = new EntityManager(),
    rabbit = manager.spawn(createRabbit(64, 64)),
    props = new PropManager();
  required(rabbit.rabbit).timer = 0;
  updateRabbitAI(rabbit, 0.1, open, [rabbit], []);
  manager.update(
    0.4,
    () => 0,
    [],
    props,
    undefined,
    () => 0,
  );
  const hop = structuredClone(rabbit.rabbit?.hop);
  startleRabbit(rabbit, { wx: 40, wy: 64 });
  expect(rabbit.rabbit?.hop).toEqual(hop);
  expect(startleRabbit(rabbit, { wx: 0, wy: 0 })).toBe(false);
  manager.update(
    0.6,
    () => 0,
    [],
    props,
    undefined,
    () => 0,
  );
  expect(rabbit.rabbit?.state).toBe("startle");
  updateRabbitAI(rabbit, 0.2, open, [rabbit], []);
  expect(rabbit.rabbit?.hop?.escaping).toBe(true);
  manager.update(
    1,
    () => 0,
    [],
    props,
    undefined,
    () => 0,
  );
  expect(rabbit.rabbit?.state).toBe("recover");
  expect(rabbit.rabbit?.alarmFrom).toBeUndefined();
});

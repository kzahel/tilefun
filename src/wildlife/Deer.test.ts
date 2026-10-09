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
import { createDeer, DEER_CLIPS, DEER_IMAGE, DEER_TYPE } from "./Deer.js";
import { updateDeerAI } from "./deerAI.js";
import { DEER_FLEE_SPEED, DEER_WALK_SPEED, startleDeer } from "./deerInteractions.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
const open = { canOccupy: () => true, isWater: () => false, surfaceZ: () => 0 };

it("uses unchanged native doe cells and real walk/alert ranges", () => {
  const metadata = JSON.parse(
    readFileSync(`public/${DEER_IMAGE.replace("sheet.png", "sprite.json")}`, "utf8"),
  );
  expect(
    createHash("sha256")
      .update(readFileSync(`public/${DEER_IMAGE}`))
      .digest("hex"),
  ).toBe(metadata.sheetSha256);
  expect(metadata.anchor).toEqual([24, 36]);
  for (const clip of DEER_CLIPS.slice(0, 3)) {
    expect(metadata.clips[clip.name].start).toBe(clip.start);
    expect(metadata.clips[clip.name].count).toBe(clip.count);
    expect(clip.frameDuration).toBe(1000 / metadata.fps);
  }
  expect(DEER_CLIPS[3].start).toBe(DEER_CLIPS[1].start);
  expect(DEER_CLIPS[3].count).toBe(DEER_CLIPS[1].count);
  expect(DEER_FLEE_SPEED * DEER_CLIPS[3].frameDuration).toBe(
    DEER_WALK_SPEED * DEER_CLIPS[1].frameDuration,
  );
});

it("seeds small stable groups in wider dry glades with whole-body tree clearance", () => {
  const coords = Array.from({ length: 16 }, (_, i) => ({
    cx: -12 + (i % 4),
    cy: -31 + Math.floor(i / 4),
  }));
  const placements = (seed: number, reverse = false) => {
    const n = new NaturalLandscape(regionalWorld(seed), "thicket");
    return (reverse ? [...coords].reverse() : coords)
      .flatMap((c) => n.wildlife(c.cx, c.cy))
      .filter((p) => p.deer)
      .sort((a, b) => a.featureId.localeCompare(b.featureId));
  };
  const deer = placements(2026);
  expect(deer.length).toBeGreaterThanOrEqual(2);
  expect(deer.length).toBeLessThanOrEqual(3);
  expect(placements(2026, true)).toEqual(deer);
  expect(placements(7)).not.toEqual(deer);
  const n = new NaturalLandscape(regionalWorld(2026), "thicket"),
    generator = createGenerator(createDescriptor("regional", 2026));
  for (const p of deer) {
    const cx = Math.floor(p.wx / 256),
      cy = Math.floor(p.wy / 256),
      ai = required(p.deer);
    expect(generator.actors?.(cx, cy)).toContainEqual(p);
    expect(ai.herdId).toContain("deer-glade:");
    const props = [-1, 0, 1]
      .flatMap((dx) => [-1, 0, 1].flatMap((dy) => n.placements(cx + dx, cy + dy)))
      .map((a) => createProp(a.propType, a.wx, a.wy));
    for (let i = 0; i < 24; i++) {
      const angle = (i * Math.PI) / 12,
        point = {
          wx: ai.home.wx + Math.cos(angle) * ai.radius,
          wy: ai.home.wy + Math.sin(angle) * ai.radius,
        };
      expect(n.terrain(point.wx / 16, point.wy / 16)).toBe(TerrainId.Grass);
      expect(n.inThicket(point.wx / 16, point.wy / 16)).toBe(false);
      const box = getEntityAABB(point, required(createDeer(point.wx, point.wy).collider));
      expect(props.some((prop) => aabbOverlapsPropWalls(box, prop.position, prop, 0, 24))).toBe(
        false,
      );
    }
  }
  expect(new Set(deer.map((p) => p.deer?.herdId)).size).toBe(1);
  for (let i = 0; i < 180; i++) n.deerGlade(i, i);
  expect(n.cacheSizes.deerGlades).toBeLessThanOrEqual(128);
});

it("walks on the ground and resumes exact saved movement/animation without vertical motion", () => {
  const manager = new EntityManager(),
    props = new PropManager(),
    deer = manager.spawn(createDeer(64, 64));
  required(deer.deer).timer = 0;
  updateDeerAI(deer, 0.1, open, [deer], []);
  expect(deer.deer?.state).toBe("travel");
  for (let i = 0; i < 27; i++)
    manager.update(
      1 / 60,
      () => 0,
      [],
      props,
      undefined,
      () => 0,
    );
  expect(Math.hypot(deer.position.wx - 64, deer.position.wy - 64)).toBeCloseTo(
    DEER_WALK_SPEED * 0.45,
    3,
  );
  expect(deer.wz).toBe(0);
  expect(deer.jumpZ).toBeUndefined();
  expect(deer.sprite?.frameCol).toBe(5);
  const restored = decodeActor(encodeActor(deer));
  if ("isProp" in restored) throw new Error("Expected deer");
  expect(restored.sprite?.frameCol).toBe(deer.sprite?.frameCol);
  const other = new EntityManager();
  other.spawn(restored);
  for (let i = 0; i < 180; i++) {
    manager.update(
      1 / 60,
      () => 0,
      [],
      props,
      undefined,
      () => 0,
    );
    other.update(
      1 / 60,
      () => 0,
      [],
      props,
      undefined,
      () => 0,
    );
    expect(restored.position).toEqual(deer.position);
    expect(restored.deer).toEqual(deer.deer);
    expect(deer.wz).toBe(0);
  }
  expect(deer.deer?.state).toBe("rest");
});

it("replicates timed walk phase in binary baselines/deltas and clears it at rest", () => {
  const deer = createDeer(64, 64);
  required(deer.deer).timer = 0;
  const before = serializeEntity(deer);
  updateDeerAI(deer, 0.1, open, [deer], []);
  setSpriteClipElapsed(deer, 437);
  const after = serializeEntity(deer);
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
  expect(deserializeEntity(required(wire.entityBaselines?.[0])).sprite?.frameCol).toBe(5);
  const replica = deserializeEntity(before);
  applyEntityDelta(replica, required(wire.entityDeltas?.[0]));
  expect(replica.sprite?.clipElapsedMs).toBe(437);
  expect(replica.sprite?.frameCol).toBe(5);
  delete required(deer.sprite).clipElapsedMs;
  applyEntityDelta(replica, required(diffEntitySnapshots(after, serializeEntity(deer))));
  expect(replica.sprite?.clipElapsedMs).toBeUndefined();
});

it("shares a nearby herd alarm, escapes away from the threat once and recovers without restarting", () => {
  const manager = new EntityManager(),
    props = new PropManager(),
    first = manager.spawn(createDeer(64, 64)),
    second = manager.spawn(createDeer(128, 64));
  required(first.deer).herdId = required(second.deer).herdId = "test-herd";
  startleDeer(first, { wx: 40, wy: 64 });
  updateDeerAI(first, 0.5, open, [first, second], []);
  updateDeerAI(second, 0.5, open, [first, second], []);
  for (const deer of [first, second]) {
    const ai = required(deer.deer);
    expect(ai.state).toBe("flee");
    expect(ai.alarmFrom).toEqual({ wx: 40, wy: 64 });
    expect(Math.hypot(ai.target.wx - 40, ai.target.wy - 64)).toBeGreaterThan(
      Math.hypot(deer.position.wx - 40, deer.position.wy - 64) + 12,
    );
    const motion = { ...ai.motion };
    expect(startleDeer(deer, { wx: 0, wy: 0 })).toBe(false);
    expect(ai.motion).toEqual(motion);
  }
  for (let i = 0; i < 160; i++)
    manager.update(
      1 / 60,
      () => 0,
      [],
      props,
      undefined,
      () => 0,
    );
  for (const deer of [first, second]) {
    expect(deer.deer?.state).toBe("recover");
    expect(deer.wz).toBe(0);
    expect(deer.jumpVZ).toBeUndefined();
  }
});

it("loosely keeps herd company and rejects water/closed routes without an alarm retry loop", () => {
  const deer = createDeer(64, 64),
    peer = createDeer(128, 64);
  required(deer.deer).herdId = required(peer.deer).herdId = "companions";
  required(deer.deer).timer = 0;
  updateDeerAI(deer, 0.1, open, [deer, peer], []);
  expect(deer.deer?.state).toBe("travel");
  expect(
    Math.hypot(
      required(deer.deer).target.wx - peer.position.wx,
      required(deer.deer).target.wy - peer.position.wy,
    ),
  ).toBeLessThan(64);
  const enclosed = createDeer(64, 64);
  startleDeer(enclosed, { wx: 40, wy: 64 });
  updateDeerAI(enclosed, 0.5, { ...open, isWater: () => true }, [enclosed], []);
  expect(enclosed.deer?.state).toBe("recover");
  expect(enclosed.deer?.alarmFrom).toBeUndefined();
  updateDeerAI(enclosed, 4, { ...open, canOccupy: () => false }, [enclosed], []);
  expect(enclosed.deer?.state).toBe("rest");
});

it("preserves a committed walk on alarm and stops at actual position when terrain is edited", () => {
  const manager = new EntityManager(),
    props = new PropManager(),
    deer = manager.spawn(createDeer(64, 64));
  required(deer.deer).timer = 0;
  updateDeerAI(deer, 0.1, open, [deer], []);
  manager.update(
    0.2,
    () => 0,
    [],
    props,
    undefined,
    () => 0,
  );
  const before = { ...deer.position };
  startleDeer(deer, { wx: 40, wy: 64 });
  expect(deer.deer?.state).toBe("travel");
  for (let i = 0; i < 200; i++)
    manager.update(
      1 / 60,
      () => CollisionFlag.Solid,
      [],
      props,
      undefined,
      () => 0,
    );
  expect(deer.position).toEqual(before);
  expect(deer.deer?.state).toBe("startle");
  updateDeerAI(deer, 0.5, { ...open, canOccupy: () => false }, [deer], []);
  expect(deer.deer?.state).toBe("recover");
});

it("runs native ground cycles in production Realm and retains group/manual identity and deletion", async () => {
  const s = await ScenarioSession.create(naturalLandscapeRecipe("deer", "thicket"));
  try {
    const deer = () => s.realm.entityManager.entities.filter((e) => e.type === DEER_TYPE);
    expect(deer().length).toBeGreaterThanOrEqual(2);
    const clips = new Set<number>();
    for (let i = 0; i < 750; i++) {
      await s.step(idle, 0.1);
      for (const d of deer()) {
        clips.add(d.sprite?.clip ?? 0);
        expect(d.wz).toBe(0);
        expect(d.jumpZ).toBeUndefined();
        expect(
          Math.hypot(
            d.position.wx - required(d.deer).home.wx,
            d.position.wy - required(d.deer).home.wy,
          ),
        ).toBeLessThanOrEqual(required(d.deer).radius + 1);
        expect(
          s.realm.world.getCollisionIfLoaded(
            Math.floor(d.position.wx / 16),
            Math.floor(d.position.wy / 16),
          ) & CollisionFlag.Water,
        ).toBe(0);
      }
    }
    expect([...clips].filter((c) => c !== 3).sort()).toEqual([0, 1, 2]);
    const removed = required(deer()[0]),
      retained = required(deer()[1]);
    s.realm.entityManager.remove(removed.id);
    const manual = s.realm.entityManager.spawn(
      createDeer(s.player.player.position.wx + 50, s.player.player.position.wy),
    );
    const saved = encodeActor(retained),
      manualId = manual.persistentId;
    await s.reload();
    expect(deer().some((d) => d.persistentId === removed.persistentId)).toBe(false);
    const restored = required(deer().find((d) => d.persistentId === saved.persistentId));
    expect(restored.deer).toEqual(saved.state.deer);
    expect(restored.position).toEqual({ wx: saved.wx, wy: saved.wy });
    expect(deer().some((d) => d.persistentId === manualId)).toBe(true);
  } finally {
    await s.close();
  }
}, 30000);
it("lands and stands on a replicated deer body until Jump is pressed", () => {
  const deer = createDeer(64, 64);
  deer.id = 1;
  const player = createPlayer(64, 64);
  player.id = 100;
  player.wz = 26;
  player.jumpZ = 26;
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
    queryEntities: () => [deer],
    queryProps: () => [],
  });
  const result = stepPlayerFromInput(
    player,
    idle,
    0.05,
    ctx,
    () => 0,
    () => ({ props: [], entities: [deer] }),
    { jumpConsumed: false, lastJumpHeld: false },
    getMovementPhysicsParams(),
  );
  predictor.update(0.05, idle, world, [], [deserializeEntity(serializeEntity(deer))]);
  expect(result.outcome.wildlifeContactId).toBe(deer.id);
  expect(player.jumpVZ).toBeUndefined();
  expect(player.jumpZ).toBeUndefined();
  expect(player.wz).toBe(24);
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
      () => ({ props: [], entities: [deer] }),
      jumpState,
      getMovementPhysicsParams(),
    );
    jumpState = step.jumpState;
    predictor.update(1 / 60, idle, world, [], [deserializeEntity(serializeEntity(deer))]);
    expect(step.outcome.wildlifeContactId).toBeUndefined();
    expect(player.wz).toBe(24);
    expect(player.jumpVZ).toBeUndefined();
    expect(predictor.player?.wz).toBe(24);
    expect(predictor.player?.jumpVZ).toBeUndefined();
  }
  stepPlayerFromInput(
    player,
    { ...idle, jump: true },
    1 / 60,
    ctx,
    () => 0,
    () => ({ props: [], entities: [deer] }),
    jumpState,
    getMovementPhysicsParams(),
  );
  predictor.update(
    1 / 60,
    { ...idle, jump: true },
    world,
    [],
    [deserializeEntity(serializeEntity(deer))],
  );
  expect(player.jumpVZ).toBeGreaterThan(0);
  expect(predictor.player?.jumpVZ).toBeCloseTo(required(player.jumpVZ), 5);
});

it("balls ricochet and startle deers; elevated balls miss and repeated alarms keep the escape intact", () => {
  for (const z of [0, 50]) {
    const manager = new EntityManager(),
      deer = manager.spawn(createDeer(64, 64));
    const ball = manager.spawn(createBall(54, 64));
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
    expect(deer.deer?.state).toBe(z ? "rest" : "startle");
    if (z) continue;
    expect(ball.velocity?.vx).toBeLessThan(0);
    expect(startleDeer(deer, { wx: 0, wy: 0 })).toBe(false);
    updateDeerAI(deer, 0.5, open, [deer], []);
    expect(deer.deer?.state).toBe("flee");
    expect(deer.wanderAI?.state).toBe("scared");
    expect(deer.deathTimer).toBeUndefined();
  }
});

it.each([true, false])(
  "Realm landing startles a deer with or without player input (input=%s)",
  async (input) => {
    const deer = createDeer(64, 64);
    deer.persistentId = "durable-deer";
    const player = createPlayer(64, 64);
    player.wz = 27;
    player.jumpZ = 27;
    player.jumpVZ = -40;
    const s = await ScenarioSession.create({
      version: 1,
      id: "deer-contact",
      generation: FLAT_SCENARIO,
      player,
      props: [],
      actors: [deer],
    });
    try {
      for (let i = 0; i < 6; i++) {
        if (input) await s.step(idle, 1 / 60);
        else s.tick(1 / 60);
      }
      const animal = required(s.realm.entityManager.entities.find((e) => e.type === DEER_TYPE));
      expect(s.player.player.jumpVZ).toBeUndefined();
      expect(animal.wanderAI?.state).toBe("scared");
      for (let i = 0; i < 40; i++) await s.step(idle, 1 / 60);
      expect(animal.deer?.state).toBe("flee");
      const saved = encodeActor(animal);
      await s.reload();
      const restored = required(s.realm.entityManager.entities.find((e) => e.type === DEER_TYPE));
      expect(restored.persistentId).toBe("durable-deer");
      expect(restored.deer).toEqual(saved.state.deer);
    } finally {
      await s.close();
    }
  },
);

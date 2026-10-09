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
import { createRobin, ROBIN_CLIPS, ROBIN_IMAGE, ROBIN_TYPE } from "./Robin.js";
import { updateRobinAI } from "./robinAI.js";
import { startleRobin } from "./robinInteractions.js";
import { robinTreePerches } from "./robinPerches.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
const open = { canOccupy: () => true, isWater: () => false, surfaceZ: () => 0 };

it("uses unchanged native robin cells and hop/flap/song ranges", () => {
  const metadata = JSON.parse(
    readFileSync(`public/${ROBIN_IMAGE.replace("sheet.png", "sprite.json")}`, "utf8"),
  );
  expect(
    createHash("sha256")
      .update(readFileSync(`public/${ROBIN_IMAGE}`))
      .digest("hex"),
  ).toBe(metadata.sheetSha256);
  expect(metadata.anchor).toEqual([16, 25]);
  for (const clip of ROBIN_CLIPS) {
    expect(metadata.clips[clip.name].start).toBe(clip.start);
    expect(metadata.clips[clip.name].count).toBe(clip.count);
    expect(clip.frameDuration).toBe(metadata.frameDurationMs);
  }
});

it("seeds dry tree-edge robins with stable owner IDs independent of query order", () => {
  const coords = [
    { cx: -11, cy: -33 },
    { cx: -10, cy: -33 },
    { cx: -11, cy: -34 },
    { cx: -10, cy: -34 },
  ];
  const placements = (seed: number, reverse = false) => {
    const n = new NaturalLandscape(regionalWorld(seed), "thicket");
    return (reverse ? [...coords].reverse() : coords)
      .flatMap((c) => n.wildlife(c.cx, c.cy))
      .filter((a) => a.robin)
      .sort((a, b) => a.featureId.localeCompare(b.featureId));
  };
  const birds = placements(2026);
  expect(birds.length).toBeGreaterThan(1);
  expect(placements(2026, true)).toEqual(birds);
  expect(placements(7)).not.toEqual(birds);
  const n = new NaturalLandscape(regionalWorld(2026), "thicket");
  const generator = createGenerator(createDescriptor("regional", 2026));
  for (const p of birds) {
    expect(n.terrain(p.wx / 16, p.wy / 16)).toBe(TerrainId.Grass);
    expect(n.inThicket(p.wx / 16, p.wy / 16)).toBe(false);
    const cx = Math.floor(p.wx / 256),
      cy = Math.floor(p.wy / 256);
    expect(generator.actors?.(cx, cy)).toContainEqual(p);
    const props = [-1, 0, 1]
      .flatMap((dx) => [-1, 0, 1].flatMap((dy) => n.placements(cx + dx, cy + dy)))
      .map((a) => createProp(a.propType, a.wx, a.wy));
    const box = getEntityAABB({ wx: p.wx, wy: p.wy }, required(createRobin(p.wx, p.wy).collider));
    expect(props.some((prop) => aabbOverlapsPropWalls(box, prop.position, prop, 0, 5))).toBe(false);
    expect(
      robinTreePerches(props).some((perch) => Math.hypot(perch.wx - p.wx, perch.wy - p.wy) < 40),
    ).toBe(true);
  }
});

it("flies onto actual oak/palm crowns, reloads the same trajectory and leaves removed trees", () => {
  for (const type of ["prop-oak-tree", "prop-palm-tree"]) {
    const manager = new EntityManager(),
      props = new PropManager();
    const tree = props.add(createProp(type, 100, 64));
    const bird = manager.spawn(createRobin(64, 64));
    const ai = required(bird.robin);
    ai.activity = 1;
    ai.timer = 0;
    const env = {
      ...open,
      perches: () => robinTreePerches(props.props),
      canOccupy: (
        entity: import("../entities/Entity.js").Entity,
        point: { wx: number; wy: number },
      ) =>
        !props.props.some((p) =>
          aabbOverlapsPropWalls(
            getEntityAABB(point, required(entity.collider)),
            p.position,
            p,
            entity.wz ?? 0,
            5,
          ),
        ),
    };
    updateRobinAI(bird, 0.1, env, [bird], []);
    expect(ai.state).toBe("flight");
    expect(ai.target.z).toBe(type === "prop-oak-tree" ? 32 : 48);
    for (let i = 0; i < 45; i++)
      manager.update(
        1 / 60,
        () => 0,
        [],
        props,
        undefined,
        () => 0,
      );
    expect(bird.wz).toBeGreaterThan(ai.target.z);
    expect(bird.sprite?.clip).toBe(2);
    const saved = decodeActor(encodeActor(bird));
    if ("isProp" in saved) throw new Error("Expected bird");
    expect(saved.sprite?.frameCol).toBe(bird.sprite?.frameCol);
    const other = new EntityManager();
    other.spawn(saved);
    for (let i = 0; i < 60; i++) {
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
      expect(saved.position).toEqual(bird.position);
      expect(saved.wz).toBe(bird.wz);
      expect(saved.robin).toEqual(bird.robin);
    }
    expect(ai.state).toBe("perch");
    expect(bird.wz).toBe(ai.target.z);
    // Actual ground tracking keeps the bird on its crown until that support changes.
    manager.update(
      0.1,
      () => 0,
      [],
      props,
      undefined,
      () => 0,
    );
    expect(bird.wz).toBe(ai.target.z);
    props.move(tree.id, 160, 64);
    expect(robinTreePerches(props.props)[0]?.wx).toBe(160);
    props.remove(tree.id);
    manager.update(
      0.1,
      () => 0,
      [],
      props,
      undefined,
      () => 0,
    );
    expect(bird.wz).toBe(0);
    ai.timer = 0;
    updateRobinAI(bird, 0.1, env, [bird], []);
    expect(ai.state).not.toBe("perch");
  }
});

it("recovers without retries in closed habitat and preserves a routine trajectory when startled", () => {
  const manager = new EntityManager(),
    props = new PropManager(),
    bird = manager.spawn(createRobin(64, 64));
  const ai = required(bird.robin);
  ai.timer = 0;
  updateRobinAI(bird, 0.1, open, [bird], []);
  expect(ai.state).toBe("hop");
  manager.update(
    0.2,
    () => 0,
    [],
    props,
    undefined,
    () => 0,
  );
  expect(bird.position).toEqual({ wx: 64, wy: 64 });
  startleRobin(bird, { wx: 40, wy: 64 });
  const motion = { ...ai.motion };
  expect(startleRobin(bird, { wx: 0, wy: 0 })).toBe(false);
  expect(ai.motion).toEqual(motion);
  for (let i = 0; i < 60; i++)
    manager.update(
      1 / 60,
      () => 0,
      [],
      props,
      undefined,
      () => 0,
    );
  expect(ai.state).toBe("startle");
  updateRobinAI(bird, 0.2, { ...open, canOccupy: () => false }, [bird], []);
  expect(ai.state).toBe("recover");
  expect(ai.alarmFrom).toBeUndefined();
  updateRobinAI(bird, 3, { ...open, canOccupy: () => false }, [bird], []);
  expect(ai.state).toBe("rest");
});

it("runs hops, flights, crown rests and songs in production Realm and saves durable individuals", async () => {
  const s = await ScenarioSession.create(naturalLandscapeRecipe("robins", "thicket"));
  try {
    const birds = () => s.realm.entityManager.entities.filter((e) => e.robin);
    expect(birds().length).toBeGreaterThan(1);
    const clips = new Set<number>();
    let perched = false;
    for (let i = 0; i < 700; i++) {
      await s.step(idle, 0.1);
      for (const bird of birds()) {
        clips.add(bird.sprite?.clip ?? 0);
        perched ||= bird.robin?.state === "perch";
        expect(
          Math.hypot(
            bird.position.wx - required(bird.robin).home.wx,
            bird.position.wy - required(bird.robin).home.wy,
          ),
        ).toBeLessThanOrEqual(required(bird.robin).radius + 1);
        expect(
          s.realm.world.getCollisionIfLoaded(
            Math.floor(bird.position.wx / 16),
            Math.floor(bird.position.wy / 16),
          ) & CollisionFlag.Water,
        ).toBe(0);
      }
    }
    expect([...clips].sort()).toEqual([0, 1, 2, 3]);
    expect(perched).toBe(true);
    const removed = required(birds()[0]),
      retained = required(birds()[1]);
    s.realm.entityManager.remove(removed.id);
    const manual = s.realm.entityManager.spawn(
      createRobin(s.player.player.position.wx + 40, s.player.player.position.wy),
    );
    const saved = encodeActor(retained),
      manualId = manual.persistentId;
    await s.reload();
    expect(birds().some((b) => b.persistentId === removed.persistentId)).toBe(false);
    expect(required(birds().find((b) => b.persistentId === saved.persistentId)).robin).toEqual(
      saved.state.robin,
    );
    expect(birds().some((b) => b.persistentId === manualId)).toBe(true);
  } finally {
    await s.close();
  }
}, 30000);
it("lands and stands on a replicated robin body until Jump is pressed", () => {
  const robin = createRobin(64, 64);
  robin.id = 1;
  const player = createPlayer(64, 64);
  player.id = 100;
  player.wz = 7;
  player.jumpZ = 7;
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
    queryEntities: () => [robin],
    queryProps: () => [],
  });
  const result = stepPlayerFromInput(
    player,
    idle,
    0.05,
    ctx,
    () => 0,
    () => ({ props: [], entities: [robin] }),
    { jumpConsumed: false, lastJumpHeld: false },
    getMovementPhysicsParams(),
  );
  predictor.update(0.05, idle, world, [], [deserializeEntity(serializeEntity(robin))]);
  expect(result.outcome.wildlifeContactId).toBe(robin.id);
  expect(player.jumpVZ).toBeUndefined();
  expect(player.jumpZ).toBeUndefined();
  expect(player.wz).toBe(5);
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
      () => ({ props: [], entities: [robin] }),
      jumpState,
      getMovementPhysicsParams(),
    );
    jumpState = step.jumpState;
    predictor.update(1 / 60, idle, world, [], [deserializeEntity(serializeEntity(robin))]);
    expect(step.outcome.wildlifeContactId).toBeUndefined();
    expect(player.wz).toBe(5);
    expect(player.jumpVZ).toBeUndefined();
    expect(predictor.player?.wz).toBe(5);
    expect(predictor.player?.jumpVZ).toBeUndefined();
  }
  stepPlayerFromInput(
    player,
    { ...idle, jump: true },
    1 / 60,
    ctx,
    () => 0,
    () => ({ props: [], entities: [robin] }),
    jumpState,
    getMovementPhysicsParams(),
  );
  predictor.update(
    1 / 60,
    { ...idle, jump: true },
    world,
    [],
    [deserializeEntity(serializeEntity(robin))],
  );
  expect(player.jumpVZ).toBeGreaterThan(0);
  expect(predictor.player?.jumpVZ).toBeCloseTo(required(player.jumpVZ), 5);
});

it("replicates mid-hop phase through binary baselines/deltas and removes it on landing", () => {
  const robin = createRobin(64, 64);
  required(robin.robin).timer = 0;
  const before = serializeEntity(robin);
  updateRobinAI(robin, 0.1, open, [robin], []);
  setSpriteClipElapsed(robin, 437);
  const after = serializeEntity(robin);
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
  delete required(robin.sprite).clipElapsedMs;
  applyEntityDelta(replica, required(diffEntitySnapshots(after, serializeEntity(robin))));
  expect(replica.sprite?.clipElapsedMs).toBeUndefined();
});

it("balls ricochet and startle robins; elevated balls miss and repeated alarms keep the escape intact", () => {
  for (const z of [0, 30]) {
    const manager = new EntityManager(),
      robin = manager.spawn(createRobin(64, 64));
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
    expect(robin.robin?.state).toBe(z ? "rest" : "startle");
    if (z) continue;
    expect(ball.velocity?.vx).toBeLessThan(0);
    expect(startleRobin(robin, { wx: 0, wy: 0 })).toBe(false);
    updateRobinAI(robin, 0.3, open, [robin], []);
    expect(robin.robin?.state).toBe("flight");
    expect(robin.wanderAI?.state).toBe("scared");
    expect(robin.deathTimer).toBeUndefined();
  }
});

it.each([true, false])(
  "Realm landing startles a robin with or without player input (input=%s)",
  async (input) => {
    const robin = createRobin(64, 64);
    robin.persistentId = "durable-robin";
    const player = createPlayer(64, 64);
    player.wz = 8;
    player.jumpZ = 8;
    player.jumpVZ = -40;
    const s = await ScenarioSession.create({
      version: 1,
      id: "robin-contact",
      generation: FLAT_SCENARIO,
      player,
      props: [],
      actors: [robin],
    });
    try {
      for (let i = 0; i < 6; i++) {
        if (input) await s.step(idle, 1 / 60);
        else s.tick(1 / 60);
      }
      const animal = required(s.realm.entityManager.entities.find((e) => e.type === ROBIN_TYPE));
      expect(s.player.player.jumpVZ).toBeUndefined();
      expect(animal.wanderAI?.state).toBe("scared");
      for (let i = 0; i < 22; i++) await s.step(idle, 1 / 60);
      expect(animal.robin?.state).toBe("flight");
      const saved = encodeActor(animal);
      await s.reload();
      const restored = required(s.realm.entityManager.entities.find((e) => e.type === ROBIN_TYPE));
      expect(restored.persistentId).toBe("durable-robin");
      expect(restored.robin).toEqual(saved.state.robin);
    } finally {
      await s.close();
    }
  },
);

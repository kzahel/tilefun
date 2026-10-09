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
import { createFrog, FROG_CLIPS, FROG_IMAGE, FROG_TYPE } from "./Frog.js";
import { updateFrogAI } from "./frogAI.js";
import { FROG_BOUNCE_VZ, startleFrog } from "./frogInteractions.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
const open = { canOccupy: () => true, isWater: () => false, surfaceZ: () => 0 };

it("uses the unchanged frog sheet and its real hop/swim/blink frame ranges", () => {
  const sprite = JSON.parse(
    readFileSync(`public/${FROG_IMAGE.replace("sheet.png", "sprite.json")}`, "utf8"),
  );
  expect(
    createHash("sha256")
      .update(readFileSync(`public/${FROG_IMAGE}`))
      .digest("hex"),
  ).toBe(sprite.sheetSha256);
  expect(sprite.anchor).toEqual([24, 34]);
  for (const clip of FROG_CLIPS) {
    expect(sprite.clips[clip.name].start).toBe(clip.start);
    expect(sprite.clips[clip.name].count).toBe(clip.count);
    expect(sprite.clips[clip.name].durationMs).toBe(clip.count * clip.frameDuration);
  }
});

it("seeds a small independent frog population on open grassy banks, in either query order", () => {
  const coords = Array.from({ length: 64 }, (_, i) => ({
    cx: 8 + (i % 8),
    cy: -16 + Math.floor(i / 8),
  }));
  const placements = (seed: number, reverse = false) => {
    const n = new NaturalLandscape(regionalWorld(seed), "thicket");
    return (reverse ? [...coords].reverse() : coords)
      .flatMap((c) => n.wildlife(c.cx, c.cy))
      .filter((p) => p.type === FROG_TYPE)
      .sort((a, b) => a.featureId.localeCompare(b.featureId));
  };
  const frogs = placements(2026);
  expect(frogs.length).toBeGreaterThanOrEqual(2);
  expect(frogs.length).toBeLessThanOrEqual(4);
  expect(placements(2026, true)).toEqual(frogs);
  expect(placements(7)).not.toEqual(frogs);
  const generator = createGenerator(createDescriptor("regional", 2026));
  const n = new NaturalLandscape(regionalWorld(2026), "thicket");
  for (const p of frogs) {
    expect(n.pondBank(p.wx / 16, p.wy / 16)).toBe(true);
    expect(n.terrain(p.wx / 16, p.wy / 16)).toBe(TerrainId.Grass);
    const box = getEntityAABB(p, required(createFrog(p.wx, p.wy).collider));
    const cx = Math.floor(p.wx / 256),
      cy = Math.floor(p.wy / 256);
    expect(generator.actors?.(cx, cy)).toContainEqual(p);
    const nearby = [-1, 0, 1].flatMap((dx) =>
      [-1, 0, 1].flatMap((dy) => generator.placements(cx + dx, cy + dy, new Set()).placements),
    );
    expect(
      nearby.some((a) => {
        const prop = createProp(a.propType, a.wx, a.wy);
        return aabbOverlapsPropWalls(box, prop.position, prop);
      }),
    ).toBe(false);
  }
});

it("hops with a stationary push, physical flight and landing recovery; reload continues the same arc", () => {
  const manager = new EntityManager(),
    props = new PropManager();
  const frog = manager.spawn(createFrog(64, 64));
  required(frog.frog).timer = 0;
  updateFrogAI(frog, 0.1, open, [frog], []);
  expect(frog.frog?.state).toBe("hop");
  manager.update(
    0.2,
    () => 0,
    [],
    props,
    undefined,
    () => 0,
  );
  expect(frog.position).toEqual({ wx: 64, wy: 64 });
  expect(frog.wz).toBe(0);
  manager.update(
    0.3,
    () => 0,
    [],
    props,
    undefined,
    () => 0,
  );
  expect(frog.wz).toBeGreaterThan(4);
  expect(frog.position).not.toEqual({ wx: 64, wy: 64 });
  expect(frog.sprite?.frameCol).toBe(4);
  const restored = decodeActor(encodeActor(frog));
  if ("isProp" in restored) throw new Error("Expected frog");
  expect(restored.sprite?.frameCol).toBe(frog.sprite?.frameCol);
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
    expect(restored.position).toEqual(frog.position);
    expect(restored.wz).toBe(frog.wz);
    expect(restored.frog).toEqual(frog.frog);
  }
  expect(frog.frog?.state).toBe("rest");
  expect(frog.wz).toBe(0);
});

it("replicates mid-hop phase through binary baselines/deltas and removes it on landing", () => {
  const frog = createFrog(64, 64);
  required(frog.frog).timer = 0;
  const before = serializeEntity(frog);
  updateFrogAI(frog, 0.1, open, [frog], []);
  setSpriteClipElapsed(frog, 560);
  const after = serializeEntity(frog);
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
  expect(baseline.sprite?.frameCol).toBe(5);
  const replica = deserializeEntity(before);
  applyEntityDelta(replica, required(wire.entityDeltas?.[0]));
  expect(replica.sprite?.clipElapsedMs).toBe(560);
  expect(replica.sprite?.frameCol).toBe(5);
  delete required(frog.sprite).clipElapsedMs;
  applyEntityDelta(replica, required(diffEntitySnapshots(after, serializeEntity(frog))));
  expect(replica.sprite?.clipElapsedMs).toBeUndefined();
});

it("balls ricochet and startle frogs; elevated balls miss and repeated alarms keep the escape intact", () => {
  for (const z of [0, 30]) {
    const manager = new EntityManager(),
      frog = manager.spawn(createFrog(64, 64));
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
    expect(frog.frog?.state).toBe(z ? "rest" : "startle");
    if (z) continue;
    expect(ball.velocity?.vx).toBeLessThan(0);
    expect(startleFrog(frog, { wx: 0, wy: 0 })).toBe(false);
    updateFrogAI(frog, 0.3, open, [frog], []);
    expect(frog.frog?.state).toBe("hop");
    expect(frog.wanderAI?.state).toBe("scared");
    expect(frog.deathTimer).toBeUndefined();
  }
});

it("predicts the same landing bounce from a replicated frog body", () => {
  const frog = createFrog(64, 64);
  frog.id = 1;
  const player = createPlayer(64, 64);
  player.id = 100;
  player.wz = 6;
  player.jumpZ = 6;
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
    queryEntities: () => [frog],
    queryProps: () => [],
  });
  const result = stepPlayerFromInput(
    player,
    idle,
    0.05,
    ctx,
    () => 0,
    () => ({ props: [], entities: [frog] }),
    { jumpConsumed: false, lastJumpHeld: false },
    getMovementPhysicsParams(),
  );
  predictor.update(0.05, idle, world, [], [deserializeEntity(serializeEntity(frog))]);
  expect(result.outcome.wildlifeContactId).toBe(frog.id);
  expect(player.jumpVZ).toBe(FROG_BOUNCE_VZ);
  expect(predictor.player?.wz).toBeCloseTo(required(player.wz), 5);
  expect(predictor.player?.jumpVZ).toBe(player.jumpVZ);
});

it("recovers in a closed habitat and lands at the actual position if new terrain blocks a hop", () => {
  const frog = createFrog(64, 64);
  startleFrog(frog, { wx: 40, wy: 64 });
  updateFrogAI(frog, 0.3, { ...open, canOccupy: () => false }, [frog], []);
  expect(frog.frog?.state).toBe("recover");
  updateFrogAI(frog, 2.1, open, [frog], []);
  expect(frog.frog?.state).toBe("rest");
  startleFrog(frog, { wx: 40, wy: 64 });
  updateFrogAI(frog, 0.3, open, [frog], []);
  const manager = new EntityManager();
  manager.spawn(frog);
  for (let i = 0; i < 15; i++)
    manager.update(
      0.1,
      () => CollisionFlag.Solid,
      [],
      new PropManager(),
      undefined,
      () => 0,
    );
  expect(frog.position).toEqual({ wx: 64, wy: 64 });
  expect(frog.wz).toBe(0);
  expect(frog.frog?.state).toBe("recover");
});

it("runs all four frog cycles, land and water in the production pond Realm, and retains saved animals/deletions", async () => {
  const s = await ScenarioSession.create(naturalLandscapeRecipe("pond", "thicket"));
  try {
    const frogs = () => s.realm.entityManager.entities.filter((e) => e.type === FROG_TYPE);
    expect(frogs().length).toBeGreaterThanOrEqual(2);
    const clips = new Set<number>(),
      media = new Set<boolean>();
    for (let i = 0; i < 1600; i++) {
      await s.step(idle, 0.1);
      for (const frog of frogs()) {
        clips.add(frog.sprite?.clip ?? 0);
        media.add(
          (s.realm.world.getCollisionIfLoaded(
            Math.floor(frog.position.wx / 16),
            Math.floor(frog.position.wy / 16),
          ) &
            CollisionFlag.Water) !==
            0,
        );
        expect(
          Math.hypot(
            frog.position.wx - required(frog.frog).home.wx,
            frog.position.wy - required(frog.frog).home.wy,
          ),
        ).toBeLessThanOrEqual(required(frog.frog).radius + 1);
      }
    }
    expect([...clips].sort()).toEqual([0, 1, 2, 3]);
    expect(media.size).toBe(2);
    const removed = required(frogs()[0]),
      retained = required(frogs()[1]);
    s.realm.entityManager.remove(removed.id);
    const manual = s.realm.entityManager.spawn(
      createFrog(s.player.player.position.wx + 24, s.player.player.position.wy),
    );
    const saved = encodeActor(retained),
      manualId = manual.persistentId;
    await s.reload();
    expect(frogs().some((f) => f.persistentId === removed.persistentId)).toBe(false);
    const restored = required(frogs().find((f) => f.persistentId === saved.persistentId));
    expect(restored.frog).toEqual(saved.state.frog);
    expect(restored.position).toEqual({ wx: saved.wx, wy: saved.wy });
    expect(frogs().some((f) => f.persistentId === manualId)).toBe(true);
  } finally {
    await s.close();
  }
}, 30000);

it.each([true, false])(
  "Realm landing startles a frog with or without player input (input=%s)",
  async (input) => {
    const frog = createFrog(64, 64);
    frog.persistentId = "durable-frog";
    const player = createPlayer(64, 64);
    player.wz = 7;
    player.jumpZ = 7;
    player.jumpVZ = -40;
    const s = await ScenarioSession.create({
      version: 1,
      id: "frog-contact",
      generation: FLAT_SCENARIO,
      player,
      props: [],
      actors: [frog],
    });
    try {
      for (let i = 0; i < 6; i++) {
        if (input) await s.step(idle, 1 / 60);
        else s.tick(1 / 60);
      }
      const animal = required(s.realm.entityManager.entities.find((e) => e.type === FROG_TYPE));
      expect(s.player.player.jumpVZ).toBeGreaterThan(0);
      expect(animal.wanderAI?.state).toBe("scared");
      for (let i = 0; i < 42; i++) await s.step(idle, 1 / 60);
      expect(animal.frog?.state).toBe("hop");
      const saved = encodeActor(animal);
      await s.reload();
      const restored = required(s.realm.entityManager.entities.find((e) => e.type === FROG_TYPE));
      expect(restored.persistentId).toBe("durable-frog");
      expect(restored.frog).toEqual(saved.state.frog);
    } finally {
      await s.close();
    }
  },
);

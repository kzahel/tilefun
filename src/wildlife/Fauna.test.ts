import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
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
import { createFauna, FAUNA_PROFILES, faunaType } from "./Fauna.js";
import { updateFaunaAI } from "./faunaAI.js";
import { startleFauna } from "./faunaInteractions.js";

describe.each(FAUNA_PROFILES.filter((p) => !["pond", "shore", "deep"].includes(p.habitat)))(
  "$species shared authority",
  (p) => {
    const createAnimal = (wx: number, wy: number) => createFauna(p.species, wx, wy);
    const CLIPS = p.clips,
      IMAGE = p.image,
      TYPE = faunaType(p.species);
    const WALK_SPEED = p.speed,
      FLEE_SPEED = p.speed * 2;
    const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
    const open = { canOccupy: () => true, isWater: () => false, surfaceZ: () => 0 };

    if (p.interest > 0)
      it("shows cautious player interest without entering the alarm radius", () => {
        let improvement = 0;
        const player = { wx: 244, wy: 64 };
        for (let seed = 1; seed <= 24; seed++) {
          const alone = createAnimal(64, 64),
            curious = createAnimal(64, 64);
          for (const a of [alone, curious]) {
            required(a.fauna).randomState = seed;
            required(a.fauna).timer = 0;
          }
          updateFaunaAI(alone, 0.1, open, [alone], []);
          updateFaunaAI(curious, 0.1, open, [curious], [player]);
          const d = (a: typeof alone) =>
            Math.hypot(
              required(a.fauna).target.wx - player.wx,
              required(a.fauna).target.wy - player.wy,
            );
          expect(d(curious)).toBeLessThanOrEqual(d(alone) + 1e-8);
          expect(d(curious)).toBeGreaterThan(p.alarmDistance);
          improvement += d(alone) - d(curious);
        }
        expect(improvement).toBeGreaterThan(20);
      });

    it("uses unchanged native draft cells and real walk/alert ranges", () => {
      const metadata = JSON.parse(
        readFileSync(`public/${IMAGE.replace("sheet.png", "sprite.json")}`, "utf8"),
      );
      expect(
        createHash("sha256")
          .update(readFileSync(`public/${IMAGE}`))
          .digest("hex"),
      ).toBe(p.sha256);
      expect(metadata.identity).toBe(p.identity);
      expect(metadata.anchor).toEqual(p.anchor);
      expect(metadata.frameWidth).toBe(p.size);
      for (const clip of CLIPS.slice(0, 3)) {
        expect(metadata.clips[clip.name].start).toBe(clip.start);
        expect(metadata.clips[clip.name].count).toBe(clip.count);
        if (metadata.fps) expect(clip.frameDuration).toBeCloseTo(1000 / metadata.fps);
      }
      expect(required(CLIPS[3]).start).toBe(required(CLIPS[1]).start);
      expect(required(CLIPS[3]).count).toBe(required(CLIPS[1]).count);
      expect(FLEE_SPEED * required(CLIPS[3]).frameDuration).toBe(
        WALK_SPEED * required(CLIPS[1]).frameDuration,
      );
    });

    it("seeds small stable groups in wider dry glades with whole-body tree clearance", () => {
      const coords = Array.from({ length: 16 }, (_, i) => ({
        cx: Math.floor(p.inspection[0] / 16) - 2 + (i % 4),
        cy: Math.floor(p.inspection[1] / 16) - 2 + Math.floor(i / 4),
      }));
      const placements = (seed: number, reverse = false) => {
        const n = new NaturalLandscape(regionalWorld(seed), "thicket");
        return (reverse ? [...coords].reverse() : coords)
          .flatMap((c) => n.wildlife(c.cx, c.cy))
          .filter((a) => a.type === TYPE)
          .sort((a, b) => a.featureId.localeCompare(b.featureId));
      };
      const animal = placements(2026);
      expect(animal.length).toBeGreaterThanOrEqual(p.group);
      expect(animal.length).toBeLessThanOrEqual(p.group);
      expect(placements(2026, true)).toEqual(animal);
      expect(placements(7)).not.toEqual(animal);
      const n = new NaturalLandscape(regionalWorld(2026), "thicket"),
        generator = createGenerator(createDescriptor("regional", 2026));
      for (const placement of animal) {
        const cx = Math.floor(placement.wx / 256),
          cy = Math.floor(placement.wy / 256),
          ai = required(placement.fauna);
        expect(generator.actors?.(cx, cy)).toContainEqual(placement);
        if (p.group > 1) expect(ai.groupId).toContain("fauna-home:");
        else expect(ai.groupId).toBeUndefined();
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
          const box = getEntityAABB(point, required(createAnimal(point.wx, point.wy).collider));
          expect(props.some((prop) => aabbOverlapsPropWalls(box, prop.position, prop, 0, 24))).toBe(
            false,
          );
        }
      }
      expect(new Set(animal.map((p) => p.fauna?.groupId)).size).toBe(1);
      for (let i = 0; i < 600; i++) n.faunaHome(i, i);
      expect(n.cacheSizes.faunaHomes).toBeLessThanOrEqual(128);
    });

    it("resumes exact saved movement and native phase", () => {
      const manager = new EntityManager(),
        props = new PropManager(),
        animal = manager.spawn(createAnimal(64, 64));
      required(animal.fauna).timer = 0;
      updateFaunaAI(animal, 0.1, open, [animal], []);
      expect(animal.fauna?.state).toBe("travel");
      for (let i = 0; i < 27; i++)
        manager.update(
          1 / 60,
          () => 0,
          [],
          props,
          undefined,
          () => 0,
        );
      expect(Math.hypot(animal.position.wx - 64, animal.position.wy - 64)).toBeCloseTo(
        p.hop ? 0 : WALK_SPEED * 0.45,
        3,
      );
      if (p.hop && animal.fauna?.motion) expect(animal.wz ?? 0).toBeGreaterThanOrEqual(0);
      else expect(animal.wz).toBe(0);
      if (!p.hop || !animal.fauna?.motion) expect(animal.jumpZ).toBeUndefined();
      expect(animal.sprite?.frameCol).toBe(
        required(CLIPS[1]).start + Math.floor(450 / required(CLIPS[1]).frameDuration),
      );
      const restored = decodeActor(encodeActor(animal));
      if ("isProp" in restored) throw new Error("Expected animal");
      expect(restored.sprite?.frameCol).toBe(animal.sprite?.frameCol);
      const other = new EntityManager();
      other.spawn(restored);
      for (let i = 0; i < 600; i++) {
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
        expect(restored.position).toEqual(animal.position);
        expect(restored.fauna).toEqual(animal.fauna);
        if (p.hop && animal.fauna?.motion) expect(animal.wz ?? 0).toBeGreaterThanOrEqual(0);
        else expect(animal.wz).toBe(0);
      }
      expect(animal.fauna?.state).toBe("rest");
    });

    it("replicates timed walk phase in binary baselines/deltas and clears it at rest", () => {
      const animal = createAnimal(64, 64);
      required(animal.fauna).timer = 0;
      const before = serializeEntity(animal);
      updateFaunaAI(animal, 0.1, open, [animal], []);
      setSpriteClipElapsed(animal, 437);
      const after = serializeEntity(animal);
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
      expect(deserializeEntity(required(wire.entityBaselines?.[0])).sprite?.frameCol).toBe(
        required(CLIPS[1]).start + Math.floor(437 / required(CLIPS[1]).frameDuration),
      );
      const replica = deserializeEntity(before);
      applyEntityDelta(replica, required(wire.entityDeltas?.[0]));
      expect(replica.sprite?.clipElapsedMs).toBe(437);
      expect(replica.sprite?.frameCol).toBe(
        required(CLIPS[1]).start + Math.floor(437 / required(CLIPS[1]).frameDuration),
      );
      delete required(animal.sprite).clipElapsedMs;
      applyEntityDelta(replica, required(diffEntitySnapshots(after, serializeEntity(animal))));
      expect(replica.sprite?.clipElapsedMs).toBeUndefined();
    });

    it("shares a nearby herd alarm, escapes away from the threat once and recovers without restarting", () => {
      const manager = new EntityManager(),
        props = new PropManager(),
        first = manager.spawn(createAnimal(64, 64)),
        second = manager.spawn(createAnimal(128, 64));
      required(first.fauna).groupId = required(second.fauna).groupId = "test-herd";
      startleFauna(first, { wx: 40, wy: 64 });
      updateFaunaAI(first, 0.5, open, [first, second], []);
      updateFaunaAI(second, 0.5, open, [first, second], []);
      for (const animal of [first, second]) {
        const ai = required(animal.fauna);
        expect(ai.state).toBe("flee");
        expect(ai.alarmFrom).toEqual({ wx: 40, wy: 64 });
        expect(Math.hypot(ai.target.wx - 40, ai.target.wy - 64)).toBeGreaterThan(
          Math.hypot(animal.position.wx - 40, animal.position.wy - 64) + p.step / 4,
        );
        const motion = { ...ai.motion };
        expect(startleFauna(animal, { wx: 0, wy: 0 })).toBe(false);
        expect(ai.motion).toEqual(motion);
      }
      for (let i = 0; i < 600; i++)
        manager.update(
          1 / 60,
          () => 0,
          [],
          props,
          undefined,
          () => 0,
        );
      for (const animal of [first, second]) {
        expect(animal.fauna?.state).toBe("recover");
        if (p.hop && animal.fauna?.motion) expect(animal.wz ?? 0).toBeGreaterThanOrEqual(0);
        else expect(animal.wz).toBe(0);
        expect(animal.jumpVZ).toBeUndefined();
      }
    });

    it("loosely keeps herd company and rejects water/closed routes without an alarm retry loop", () => {
      const animal = createAnimal(64, 64),
        peer = createAnimal(64 + Math.max(64, p.body[0] * 2), 64);
      required(animal.fauna).groupId = required(peer.fauna).groupId = "companions";
      required(animal.fauna).timer = 0;
      updateFaunaAI(animal, 0.1, open, [animal, peer], []);
      expect(animal.fauna?.state).toBe("travel");
      if (p.cohesion > 0)
        expect(
          Math.hypot(
            required(animal.fauna).target.wx - peer.position.wx,
            required(animal.fauna).target.wy - peer.position.wy,
          ),
        ).toBeLessThan(Math.max(64, p.body[0] * 2));
      const enclosed = createAnimal(64, 64);
      startleFauna(enclosed, { wx: 40, wy: 64 });
      updateFaunaAI(enclosed, 0.5, { ...open, isWater: () => true }, [enclosed], []);
      expect(enclosed.fauna?.state).toBe("recover");
      expect(enclosed.fauna?.alarmFrom).toBeUndefined();
      updateFaunaAI(enclosed, 4, { ...open, canOccupy: () => false }, [enclosed], []);
      expect(enclosed.fauna?.state).toBe("rest");
    });

    it("preserves a committed walk on alarm and stops at actual position when terrain is edited", () => {
      const manager = new EntityManager(),
        props = new PropManager(),
        animal = manager.spawn(createAnimal(64, 64));
      required(animal.fauna).timer = 0;
      updateFaunaAI(animal, 0.1, open, [animal], []);
      manager.update(
        0.2,
        () => 0,
        [],
        props,
        undefined,
        () => 0,
      );
      const before = { ...animal.position };
      startleFauna(animal, { wx: 40, wy: 64 });
      expect(animal.fauna?.state).toBe("travel");
      for (let i = 0; i < 200; i++)
        manager.update(
          1 / 60,
          () => CollisionFlag.Solid,
          [],
          props,
          undefined,
          () => 0,
        );
      expect(animal.position).toEqual(before);
      expect(animal.fauna?.state).toBe("startle");
      updateFaunaAI(animal, 0.5, { ...open, canOccupy: () => false }, [animal], []);
      expect(animal.fauna?.state).toBe("recover");
    });

    it("runs native ground cycles in production Realm and retains group/manual identity and deletion", async () => {
      const s = await ScenarioSession.create(naturalLandscapeRecipe(p.species, "thicket"));
      try {
        const animal = () => s.realm.entityManager.entities.filter((e) => e.type === TYPE);
        expect(animal().length).toBeGreaterThanOrEqual(p.group);
        const clips = new Set<number>();
        for (let i = 0; i < 750; i++) {
          await s.step(idle, 0.1);
          for (const d of animal()) {
            clips.add(d.sprite?.clip ?? 0);
            if (p.hop) expect(d.wz ?? 0).toBeGreaterThanOrEqual(0);
            else expect(d.wz).toBe(0);
            if (!p.hop || !d.fauna?.motion) expect(d.jumpZ).toBeUndefined();
            expect(
              Math.hypot(
                d.position.wx - required(d.fauna).home.wx,
                d.position.wy - required(d.fauna).home.wy,
              ),
            ).toBeLessThanOrEqual(required(d.fauna).radius + 1);
            expect(
              s.realm.world.getCollisionIfLoaded(
                Math.floor(d.position.wx / 16),
                Math.floor(d.position.wy / 16),
              ) & CollisionFlag.Water,
            ).toBe(0);
          }
        }
        expect([...clips].filter((c) => c !== 3).sort()).toEqual([0, 1, 2]);
        const removed = required(animal()[0]),
          retained =
            animal()[1] ??
            s.realm.entityManager.spawn(
              createAnimal(s.player.player.position.wx + 100, s.player.player.position.wy),
            );
        s.realm.entityManager.remove(removed.id);
        const manual = s.realm.entityManager.spawn(
          createAnimal(s.player.player.position.wx + 50, s.player.player.position.wy),
        );
        const saved = encodeActor(retained),
          manualId = manual.persistentId;
        await s.reload();
        expect(animal().some((d) => d.persistentId === removed.persistentId)).toBe(false);
        const restored = required(animal().find((d) => d.persistentId === saved.persistentId));
        expect(restored.fauna).toEqual(saved.state.fauna);
        expect(restored.position).toEqual({ wx: saved.wx, wy: saved.wy });
        expect(animal().some((d) => d.persistentId === manualId)).toBe(true);
      } finally {
        await s.close();
      }
    }, 30000);
    it("lands and stands on a replicated animal body until Jump is pressed", () => {
      const animal = createAnimal(64, 64);
      animal.id = 1;
      const player = createPlayer(64, 64);
      player.id = 100;
      player.wz = p.body[2] + 2;
      player.jumpZ = p.body[2] + 2;
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
        queryEntities: () => [animal],
        queryProps: () => [],
      });
      const result = stepPlayerFromInput(
        player,
        idle,
        0.05,
        ctx,
        () => 0,
        () => ({ props: [], entities: [animal] }),
        { jumpConsumed: false, lastJumpHeld: false },
        getMovementPhysicsParams(),
      );
      predictor.update(0.05, idle, world, [], [deserializeEntity(serializeEntity(animal))]);
      expect(result.outcome.wildlifeContactId).toBe(animal.id);
      expect(player.jumpVZ).toBeUndefined();
      expect(player.jumpZ).toBeUndefined();
      expect(player.wz).toBe(p.body[2]);
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
          () => ({ props: [], entities: [animal] }),
          jumpState,
          getMovementPhysicsParams(),
        );
        jumpState = step.jumpState;
        predictor.update(1 / 60, idle, world, [], [deserializeEntity(serializeEntity(animal))]);
        expect(step.outcome.wildlifeContactId).toBeUndefined();
        expect(player.wz).toBe(p.body[2]);
        expect(player.jumpVZ).toBeUndefined();
        expect(predictor.player?.wz).toBe(p.body[2]);
        expect(predictor.player?.jumpVZ).toBeUndefined();
      }
      stepPlayerFromInput(
        player,
        { ...idle, jump: true },
        1 / 60,
        ctx,
        () => 0,
        () => ({ props: [], entities: [animal] }),
        jumpState,
        getMovementPhysicsParams(),
      );
      predictor.update(
        1 / 60,
        { ...idle, jump: true },
        world,
        [],
        [deserializeEntity(serializeEntity(animal))],
      );
      expect(player.jumpVZ).toBeGreaterThan(0);
      expect(predictor.player?.jumpVZ).toBeCloseTo(required(player.jumpVZ), 5);
    });

    it("balls ricochet and startle animals; elevated balls miss and repeated alarms keep the escape intact", () => {
      for (const z of [0, p.body[2] + 30]) {
        const manager = new EntityManager(),
          animal = manager.spawn(createAnimal(64, 64));
        const ball = manager.spawn(createBall(64 - p.body[0] / 2 - 2, 64));
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
        expect(animal.fauna?.state).toBe(z ? "rest" : "startle");
        if (z) continue;
        expect(ball.velocity?.vx).toBeLessThan(0);
        expect(startleFauna(animal, { wx: 0, wy: 0 })).toBe(false);
        updateFaunaAI(animal, 0.5, open, [animal], []);
        expect(animal.fauna?.state).toBe("flee");
        expect(animal.wanderAI?.state).toBe("scared");
        expect(animal.deathTimer).toBeUndefined();
      }
    });

    it.each([true, false])(
      "Realm landing startles a animal with or without player input (input=%s)",
      async (input) => {
        const animal = createAnimal(64, 64);
        animal.persistentId = "durable-animal";
        const player = createPlayer(64, 64);
        player.wz = p.body[2] + 3;
        player.jumpZ = p.body[2] + 3;
        player.jumpVZ = -40;
        const s = await ScenarioSession.create({
          version: 1,
          id: "animal-contact",
          generation: FLAT_SCENARIO,
          player,
          props: [],
          actors: [animal],
        });
        try {
          for (let i = 0; i < 6; i++) {
            if (input) await s.step(idle, 1 / 60);
            else s.tick(1 / 60);
          }
          const animal = required(s.realm.entityManager.entities.find((e) => e.type === TYPE));
          expect(s.player.player.jumpVZ).toBeUndefined();
          expect(animal.wanderAI?.state).toBe("scared");
          for (let i = 0; i < 40; i++) await s.step(idle, 1 / 60);
          expect(animal.fauna?.state).toBe("flee");
          const saved = encodeActor(animal);
          await s.reload();
          const restored = required(s.realm.entityManager.entities.find((e) => e.type === TYPE));
          expect(restored.persistentId).toBe("durable-animal");
          expect(restored.fauna).toEqual(saved.state.fauna);
        } finally {
          await s.close();
        }
      },
    );
  },
);

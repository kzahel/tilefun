import { describe, expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { TerrainId } from "../autotile/TerrainId.js";
import { PlayerPredictor } from "../client/PlayerPredictor.js";
import { createBall } from "../entities/Ball.js";
import { EntityManager } from "../entities/EntityManager.js";
import { createPlayer } from "../entities/Player.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import { encodeActor } from "../persistence/ActorRecords.js";
import { tickBallPhysics } from "../physics/BallPhysics.js";
import { getMovementPhysicsParams, stepPlayerFromInput } from "../physics/PlayerMovement.js";
import { createMovementContext } from "../physics/SimulationEnvironment.js";
import { FLAT_SCENARIO } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import { World } from "../world/World.js";
import { createFauna, FAUNA_PROFILES, faunaType } from "./Fauna.js";
import { updateFaunaAI } from "./faunaAI.js";
import { startleFauna } from "./faunaInteractions.js";

describe.each(FAUNA_PROFILES)("$species ordinary wildlife body", (p) => {
  const createAnimal = (wx: number, wy: number) => createFauna(p.species, wx, wy),
    TYPE = faunaType(p.species);
  const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
  const aquatic = p.habitat === "pond" || p.habitat === "deep";
  const open = {
    canOccupy: () => true,
    isWater: () => aquatic,
    isDeepWater: () => aquatic,
    surfaceZ: () => 0,
  };
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
        if (aquatic)
          for (let y = -10; y <= 20; y++)
            for (let x = -10; x <= 20; x++)
              s.realm.terrainEditor.applyTileEdit(x, y, TerrainId.DeepWater, "positive", 0);
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
});

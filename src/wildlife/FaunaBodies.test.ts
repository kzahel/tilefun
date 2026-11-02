import { describe, expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { TerrainId } from "../autotile/TerrainId.js";
import { createBall } from "../entities/Ball.js";
import { EntityManager } from "../entities/EntityManager.js";
import { createPlayer } from "../entities/Player.js";
import { encodeActor } from "../persistence/ActorRecords.js";
import { tickBallPhysics } from "../physics/BallPhysics.js";
import { FLAT_SCENARIO } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
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
    "Realm landing mounts horses or startles other wildlife (input=%s)",
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
        if (p.rideSpeed) {
          expect(s.player.gameplaySession.mountId).toBe(animal.id);
          expect(animal.wanderAI?.state).toBe("ridden");
          expect(animal.fauna?.motion).toBeUndefined();
          await s.reload();
          const restored = required(s.realm.entityManager.entities.find((e) => e.type === TYPE));
          expect(restored.persistentId).toBe("durable-animal");
          expect(s.player.gameplaySession.mountId).toBe(restored.id);
          expect(s.player.player.parentId).toBe(restored.id);
          return;
        }
        const defensive = p.species === "hedgehog" || p.species === "porcupine";
        if (defensive) {
          for (let i = 0; i < 90 && !animal.animalWork?.defenseReady; i++)
            await s.step(idle, 1 / 60);
          expect(animal.animalWork?.defenseReady).toBe(true);
          expect(animal.animalWork?.state).toBe(p.species === "hedgehog" ? "curled" : "rattle");
          expect(animal.fauna?.motion).toBeUndefined();
          expect(animal.wz ?? 0).toBe(0);
          expect(s.player.gameplaySession.mountId).toBeNull();
          expect(s.player.player.deathTimer).toBeUndefined();
        } else {
          expect(animal.wanderAI?.state).toBe("scared");
          for (let i = 0; i < 40 && animal.fauna?.state !== "flee"; i++) await s.step(idle, 1 / 60);
          expect(animal.fauna?.state).toBe("flee");
          // Capture an active phase even for a short butterfly flight.
          for (let i = 0; i < 5; i++) await s.step(idle, 1 / 60);
          expect(animal.fauna?.state).toBe("flee");
          expect(animal.fauna?.motion?.elapsed).toBeGreaterThan(0);
        }
        const saved = encodeActor(animal);
        await s.reload();
        const restored = required(s.realm.entityManager.entities.find((e) => e.type === TYPE));
        expect(restored.persistentId).toBe("durable-animal");
        expect(restored.fauna).toEqual(saved.state.fauna);
        if (defensive) expect(restored.animalWork).toEqual(saved.state.animalWork);
      } finally {
        await s.close();
      }
    },
  );
});

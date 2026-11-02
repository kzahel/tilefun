import { expect, it } from "vitest";
import { createPlayer } from "../entities/Player.js";
import { FLAT_SCENARIO } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { createFauna, faunaType } from "./Fauna.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
// These are different gameplay reactions, not a physics matrix for every skin/profile.
it.each(["horse", "porcupine", "dog"] as const)(
  "shared landing preserves the %s contact reaction and durable identity",
  async (species) => {
    const animal = createFauna(species, 64, 64),
      player = createPlayer(64, 64);
    animal.persistentId = "contact-animal";
    player.wz = (animal.collider?.physicalHeight ?? 8) + 3;
    player.jumpVZ = -40;
    const s = await ScenarioSession.create({
      version: 1,
      id: `contact-${species}`,
      generation: FLAT_SCENARIO,
      player,
      props: [],
      actors: [animal],
    });
    try {
      for (let tick = 0; tick < 6; tick++) await s.step(idle);
      const target = s.realm.entityManager.entities.find(
        (entity) => entity.type === faunaType(species),
      );
      if (!target) throw Error("Missing contact animal");
      if (species === "horse") {
        expect(s.player.gameplaySession.mountId).toBe(target.id);
        expect(target.wanderAI?.state).toBe("ridden");
      } else if (species === "porcupine") {
        for (let tick = 0; tick < 90 && !target.animalWork?.defenseReady; tick++)
          await s.step(idle);
        expect(target.animalWork?.defenseReady).toBe(true);
        expect(s.player.player.deathTimer).toBeUndefined();
      } else expect(target.wanderAI?.state).toBe("scared");
      await s.reload();
      const restored = s.realm.entityManager.entities.find(
        (entity) => entity.persistentId === "contact-animal",
      );
      expect(restored?.type).toBe(faunaType(species));
      if (species === "horse") expect(s.player.gameplaySession.mountId).toBe(restored?.id);
    } finally {
      await s.close();
    }
  },
);

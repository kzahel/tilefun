import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { createPlayer } from "../entities/Player.js";
import { FLAT_SCENARIO } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { createFauna, faunaProfile, faunaType } from "./Fauna.js";
import { canEat } from "./FoodWeb.js";
import { createPredator } from "./Predator.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
it.each(["donkey", "mule", "camel"] as const)(
  "%s is reachable by a normal ground jump and retains riding through reload",
  async (species) => {
    const animal = createFauna(species, 64, 64),
      profile = required(faunaProfile(animal.type));
    animal.persistentId = "grazer-mount";
    required(animal.fauna).state = "recover";
    required(animal.fauna).timer = 10;
    // Existing saved animals may predate the profile's riding speed.
    delete required(animal.wanderAI).rideSpeed;
    const s = await ScenarioSession.create({
      version: 1,
      id: `jump-mount-${species}`,
      generation: FLAT_SCENARIO,
      player: createPlayer(36, 64),
      actors: [animal],
      props: [],
    });
    const mount = () =>
      required(s.realm.entityManager.entities.find((e) => e.type === faunaType(species)));
    try {
      for (let i = 0; i < 60 && s.player.gameplaySession.mountId === null; i++)
        await s.step({ ...idle, dx: 1, jump: true });
      expect(s.player.gameplaySession.mountId).toBe(mount().id);
      expect(s.player.player.parentId).toBe(mount().id);
      expect(s.player.player.wz).toBe(profile.body[2]);
      expect(canEat(createPredator("t-rex", 0, 0), mount())).toBe(false);
      await s.step(idle);
      await s.reload();
      expect(s.player.gameplaySession.mountId).toBe(mount().id);
      const x = mount().position.wx;
      for (let i = 0; i < 30; i++) await s.step({ ...idle, dx: 1 });
      expect(mount().position.wx - x).toBeCloseTo(required(profile.rideSpeed) / 2, 1);
      expect(mount().sprite?.clip).toBe(4);
      await s.step({ ...idle, jump: true });
      expect(s.player.gameplaySession.mountId).toBeNull();
      expect(s.player.player.parentId).toBeUndefined();
    } finally {
      await s.close();
    }
  },
);

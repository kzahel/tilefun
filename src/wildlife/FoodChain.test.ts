import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { naturalLandscapeRecipe } from "../scenarios/NaturalLandscapeRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { creatureSpecies } from "./FoodWeb.js";

const idle = { dx: 0, dy: 0, sprinting: false, jump: false };
it.each(["food-web-natural", "food-web-placed"])(
  "runs cross-predator food chains and reloads the origin policy: %s",
  async (id) => {
    const session = await ScenarioSession.create(naturalLandscapeRecipe(id, "balanced"));
    try {
      const animals = () => session.realm.entityManager.entities.filter((e) => creatureSpecies(e));
      const rex = () => required(animals().find((e) => creatureSpecies(e) === "t-rex"));
      const wolf = required(animals().find((e) => creatureSpecies(e) === "dire-wolf"));
      const original = wolf.persistentId,
        count = animals().length;
      expect(count).toBe(4);
      for (let i = 0; i < 900 && !rex().predator?.meals; i++) {
        await session.step(idle);
        if (id === "food-web-natural")
          expect(animals().length + session.realm.entityManager.wildlifeRespawns.size).toBe(count);
        else expect(animals().length).toBeLessThanOrEqual(count);
      }
      expect(rex().predator?.meals).toBeGreaterThan(0);
      expect(animals().some((e) => e.persistentId === original)).toBe(false);
      const next = animals().find((e) => creatureSpecies(e) === "dire-wolf");
      if (id === "food-web-natural") {
        expect(
          next?.naturalSpawnId ??
            [...session.realm.entityManager.wildlifeRespawns.values()].find(
              (j) => j.actor.type === wolf.type,
            )?.actor.state.naturalSpawnId,
        ).toBe(wolf.naturalSpawnId);
        expect(animals().length + session.realm.entityManager.wildlifeRespawns.size).toBe(count);
      } else {
        expect(next).toBeUndefined();
        expect(animals().length).toBeLessThan(count);
      }
      const types = animals()
        .map((e) => e.type)
        .sort();
      const survivors = animals()
        .map((e) => e.persistentId)
        .sort();
      await session.reload();
      expect(
        animals()
          .map((e) => e.type)
          .sort(),
      ).toEqual(types);
      expect(
        animals()
          .map((e) => e.persistentId)
          .sort(),
      ).toEqual(survivors);
      for (let i = 0; i < 1200; i++) await session.step(idle);
      if (id === "food-web-natural")
        expect(animals().length + session.realm.entityManager.wildlifeRespawns.size).toBe(count);
      else expect(animals().length).toBeLessThan(count);
      await session.reload();
      expect(animals().some((e) => e.persistentId === original)).toBe(false);
    } finally {
      await session.close();
    }
  },
  // Runs up to 2,100 real Realm ticks and two reloads; CI CPU contention can
  // exceed Vitest's default five seconds without changing simulated behavior.
  15_000,
);
it("a full wolf pack converges on one prey in the ordinary Realm and survives reload", async () => {
  const session = await ScenarioSession.create(naturalLandscapeRecipe("wolf-pack", "balanced"));
  try {
    const wolves = () =>
      session.realm.entityManager.entities.filter((e) => creatureSpecies(e) === "dire-wolf");
    let shared = false;
    for (let i = 0; i < 300; i++) {
      await session.step(idle);
      const targets = wolves()
        .map((e) => e.predator?.targetId)
        .filter(Boolean);
      if (targets.length > 1 && new Set(targets).size === 1) shared = true;
      if (wolves().some((e) => e.predator?.meals)) break;
    }
    expect(shared).toBe(true);
    expect(wolves().some((e) => e.predator?.meals)).toBe(true);
    await session.reload();
    expect(wolves()).toHaveLength(3);
    expect(new Set(wolves().map((e) => e.predator?.packId))).toEqual(new Set(["lab-pack"]));
  } finally {
    await session.close();
  }
});

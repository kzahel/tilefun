import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { creatureSpecies } from "../wildlife/FoodWeb.js";
import { PREDATOR_PROFILES, predatorType } from "../wildlife/Predator.js";
import { naturalLandscapeRecipe } from "./NaturalLandscapeRecipe.js";
import { ScenarioSession } from "./ScenarioSession.js";

// Existing Predator/NaturalHunters/AquaticHunters suites own diets, catch policy,
// generated lineage and repeated replacement. This covers the exact interactive
// recipes' remaining population and first saved feeding pose, formerly a browser
// species x renderer matrix. Browser pause/publication remains in focused cases.
it.each(PREDATOR_PROFILES)(
  "$species recipe reloads its exact feeding pose and survivors",
  async (p) => {
    const aquatic = p.expansion?.habitat === "deep";
    const session = await ScenarioSession.create(naturalLandscapeRecipe(p.species, "thicket"));
    try {
      const animals = () => session.realm.entityManager.entities.filter((e) => creatureSpecies(e));
      const hunter = () => required(animals().find((e) => e.type === predatorType(p.species)));
      const observed = () =>
        aquatic
          ? animals().filter(
              (e) => e.type === predatorType(p.species) || creatureSpecies(e) === "fish",
            )
          : animals();
      const prey = () => animals().filter((e) => e.type !== predatorType(p.species));
      const fish = () => prey().filter((e) => creatureSpecies(e) === "fish");
      const population = aquatic ? fish().length : prey().length;
      if (aquatic) expect(population).toBeGreaterThanOrEqual(3);
      else expect(population).toBe(2);
      for (let i = 0; i < 1800; i++) {
        if (hunter().sprite?.clip === 2 && (aquatic ? fish().length : prey().length) < population)
          break;
        session.tick(1 / 60);
      }
      expect(hunter().predator?.meals).toBeGreaterThan(0);
      expect(hunter().sprite?.clip).toBe(2);
      const remaining = aquatic ? fish().length : prey().length;
      if (aquatic) expect(remaining).toBeLessThan(population);
      else expect(remaining).toBe(1);
      // Compare the complete saved return queue by stable actor identity.
      const pending = () =>
        [...session.realm.entityManager.wildlifeRespawns.values()].sort((a, b) =>
          a.actor.persistentId.localeCompare(b.actor.persistentId),
        );
      const before = {
        position: { ...hunter().position },
        z: hunter().wz ?? 0,
        clip: hunter().sprite?.clip,
        frame: hunter().sprite?.frameCol,
        survivors: observed()
          .map((e) => [e.persistentId, e.type])
          .sort(),
        pending: structuredClone(pending()),
      };
      await session.reload();
      expect(hunter().position).toEqual(before.position);
      expect(hunter().wz ?? 0).toBe(before.z);
      expect(hunter().sprite?.clip).toBe(before.clip);
      expect(hunter().sprite?.frameCol).toBe(before.frame);
      expect(
        observed()
          .map((e) => [e.persistentId, e.type])
          .sort(),
      ).toEqual(before.survivors);
      expect(pending()).toEqual(before.pending);
      expect(aquatic ? fish().length : prey().length).toBe(remaining);
    } finally {
      await session.close();
    }
  },
);

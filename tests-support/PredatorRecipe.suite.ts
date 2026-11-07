import { expect, it } from "vitest";
import { naturalLandscapeRecipe } from "../src/scenarios/NaturalLandscapeRecipe.js";
import { ScenarioSession } from "../src/scenarios/ScenarioSession.js";
import { required } from "../src/shared/required.js";
import { creatureSpecies } from "../src/wildlife/FoodWeb.js";
import { PREDATOR_PROFILES, predatorType } from "../src/wildlife/Predator.js";
import { testPart } from "./TestParts.test-helper.js";

// Existing Predator/NaturalHunters/AquaticHunters suites own diets, catch policy,
// generated lineage and repeated replacement. This covers the exact interactive
// recipes' remaining population and first saved feeding pose, formerly a browser
// species x renderer matrix. Browser pause/publication remains in focused cases.

/** Per-species interactive predator recipe reload cases for one `PredatorRecipe.partN.test.ts` slice. */
export function definePredatorRecipeSuite(partFileUrl: string): void {
  it.each(testPart(PREDATOR_PROFILES, partFileUrl))(
    "$species recipe reloads its exact feeding pose and survivors",
    async (p) => {
      const aquatic = p.expansion?.habitat === "deep";
      const session = await ScenarioSession.create(naturalLandscapeRecipe(p.species, "thicket"));
      try {
        const animals = () =>
          session.realm.entityManager.entities.filter((e) => creatureSpecies(e));
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
          session.tick();
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
    // Aquatic recipes build and reload a regional habitat; hosted runs can exceed 5s.
    process.env.CI ? 30_000 : 5_000,
  );
}

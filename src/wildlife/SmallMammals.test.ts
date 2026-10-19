import { describe, expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { EntityManager } from "../entities/EntityManager.js";
import { durableId } from "../persistence/ActorRecords.js";
import { createFauna } from "./Fauna.js";
import { canEat } from "./FoodWeb.js";
import { createPredator, PREDATOR_PROFILES } from "./Predator.js";
import { resolvePredatorCatches } from "./predatorAI.js";
import { SMALL_MAMMAL_PROFILES } from "./SmallMammals.js";
import { tickWildlifeRespawns } from "./WildlifeRespawns.js";

const pets = new Set(["hamster", "guinea-pig"]);
const land = { isWater: () => false, canOccupy: () => true, surfaceZ: () => 0 };
describe.each(SMALL_MAMMAL_PROFILES)("$species food-web origin", (p) => {
  if (pets.has(p.species)) {
    it("keeps domestic pocket pets protected from every hunter", () => {
      for (const hunter of PREDATOR_PROFILES)
        expect(canEat(createPredator(hunter.species, 0, 0), createFauna(p.species, 0, 0))).toBe(
          false,
        );
    });
    return;
  }
  for (const natural of [false, true])
    it(`${natural ? "natural" : "placed"} prey follows the replacement lineage policy`, () => {
      const manager = new EntityManager();
      const hunter = manager.spawn(createPredator("t-rex", 0, 0));
      const probe = createFauna(p.species, 0, 0);
      const prey = manager.spawn(
        createFauna(
          p.species,
          (required(hunter.collider).width + required(probe.collider).width) / 2 + 1,
          0,
        ),
      );
      expect(canEat(hunter, prey)).toBe(true);
      required(prey.fauna).home = { wx: 120, wy: 64 };
      required(prey.fauna).groupId = "original-small-mammal-group";
      if (natural) prey.naturalSpawnId = "natural-small-mammal";
      Object.assign(required(hunter.predator), {
        state: "pounce",
        elapsed: 0.5,
        targetId: durableId(prey),
      });
      resolvePredatorCatches(manager, [...manager.entities], land, []);
      expect(manager.byId.has(prey.id)).toBe(false);
      expect(hunter.predator?.meals).toBe(1);
      expect(manager.wildlifeRespawns.size).toBe(natural ? 1 : 0);
      tickWildlifeRespawns(manager, 120, land, []);
      const replacements = manager.entities.filter((e) => e.type === prey.type);
      expect(replacements).toHaveLength(natural ? 1 : 0);
      if (natural) {
        const replacement = required(replacements[0]);
        expect(replacement.naturalSpawnId).toBe("natural-small-mammal");
        expect(replacement.fauna?.home).toEqual(replacement.position);
        expect(replacement.fauna?.groupId).toBe("original-small-mammal-group");
        expect(replacement.persistentId).not.toBe(prey.persistentId);
      }
    });
});

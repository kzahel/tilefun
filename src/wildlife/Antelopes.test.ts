import { describe, expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { EntityManager } from "../entities/EntityManager.js";
import { durableId } from "../persistence/ActorRecords.js";
import { ANTELOPE_PROFILES } from "./Antelopes.js";
import { createFauna } from "./Fauna.js";
import { canEat } from "./FoodWeb.js";
import { createPredator } from "./Predator.js";
import { resolvePredatorCatches } from "./predatorAI.js";

const open = { canOccupy: () => true, isWater: () => false, surfaceZ: () => 0 };
describe.each(ANTELOPE_PROFILES)("$species prey ownership", (p) => {
  it.each([true, false])(
    "a tiger consumes it and replacement follows natural origin (%s)",
    (natural) => {
      const manager = new EntityManager();
      const tiger = manager.spawn(createPredator("tiger", 0, 0));
      const prey = manager.spawn(createFauna(p.species, 0, 0));
      prey.position.wx = (required(tiger.collider).width + required(prey.collider).width) / 2 + 1;
      if (natural) prey.naturalSpawnId = `world-antelope:${p.species}`;
      required(prey.fauna).home = { wx: 90, wy: 64 };
      expect(canEat(tiger, prey)).toBe(true);
      expect(canEat(createPredator("cheetah", 0, 0), prey)).toBe(p.species !== "gemsbok-oryx");
      expect(canEat(createPredator("bobcat", 0, 0), prey)).toBe(false);
      Object.assign(required(tiger.predator), {
        state: "pounce",
        elapsed: 0.5,
        targetId: durableId(prey),
      });
      resolvePredatorCatches(manager, [...manager.entities], open, []);
      expect(manager.byId.has(prey.id)).toBe(false);
      expect(tiger.predator?.meals).toBe(1);
      const replacements = manager.entities.filter((e) => e.type === prey.type);
      expect(replacements).toHaveLength(natural ? 1 : 0);
      if (natural) {
        expect(replacements[0]?.naturalSpawnId).toBe(prey.naturalSpawnId);
        expect(replacements[0]?.fauna?.home).toEqual(prey.fauna?.home);
        expect(replacements[0]?.persistentId).not.toBe(prey.persistentId);
      }
    },
  );
});

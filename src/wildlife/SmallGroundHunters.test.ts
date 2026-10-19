import { describe, expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { EntityManager } from "../entities/EntityManager.js";
import { durableId } from "../persistence/ActorRecords.js";
import { createFauna, faunaType } from "./Fauna.js";
import { canEat } from "./FoodWeb.js";
import { createPredator } from "./Predator.js";
import { resolvePredatorCatches } from "./predatorAI.js";
import { tickWildlifeRespawns } from "./WildlifeRespawns.js";

const land = { isWater: () => false, canOccupy: () => true, surfaceZ: () => 0 };
const cases = [
  { hunter: "mongoose", prey: () => createFauna("king-cobra", 0, 0) },
  { hunter: "honey-badger", prey: () => createPredator("mongoose", 0, 0) },
  { hunter: "fossa", prey: () => createPredator("white-nosed-coati", 0, 0) },
  { hunter: "white-nosed-coati", prey: () => createFauna("cricket", 0, 0) },
] as const;

describe.each(cases)("$hunter directed meals", ({ hunter: species, prey: factory }) => {
  it("remains prey for larger hunters without reversing that relationship", () => {
    const hunter = createPredator(species, 0, 0);
    const rex = createPredator("t-rex", 30, 0);
    expect(canEat(rex, hunter)).toBe(true);
    expect(canEat(hunter, rex)).toBe(false);
    expect(canEat(hunter, hunter)).toBe(false);
  });
  for (const natural of [false, true])
    it(`${natural ? "natural" : "placed"} meals retain their origin policy across prey kinds`, () => {
      const manager = new EntityManager();
      const hunter = manager.spawn(createPredator(species, 0, 0));
      const prey = manager.spawn(factory());
      prey.position.wx = (required(hunter.collider).width + required(prey.collider).width) / 2 + 1;
      expect(canEat(hunter, prey)).toBe(true);
      required(prey.predator ?? prey.fauna).home = { wx: 120, wy: 64 };
      if (prey.predator) {
        prey.predator.packId = "original-small-hunter-pack";
        prey.predator.state = "pounce";
        prey.predator.targetId = "stale-hunt";
      } else required(prey.fauna).groupId = "original-small-prey-group";
      if (natural) prey.naturalSpawnId = "natural-directed-prey";
      Object.assign(required(hunter.predator), {
        state: "pounce",
        elapsed: 0.5,
        targetId: durableId(prey),
      });
      if (prey.type === faunaType("cricket")) {
        prey.jumpZ = 3;
        resolvePredatorCatches(manager, [...manager.entities], land, []);
        expect(manager.byId.has(prey.id)).toBe(true);
        expect(hunter.predator?.meals).toBe(0);
        prey.jumpZ = 0;
      }
      resolvePredatorCatches(manager, [...manager.entities], land, []);
      expect(manager.byId.has(prey.id)).toBe(false);
      expect(hunter.predator?.meals).toBe(1);
      expect(manager.wildlifeRespawns.size).toBe(natural ? 1 : 0);
      tickWildlifeRespawns(manager, 120, land, []);
      const replacements = manager.entities.filter((e) => e.type === prey.type);
      expect(replacements).toHaveLength(natural ? 1 : 0);
      if (natural) {
        const replacement = required(replacements[0]);
        expect(replacement.naturalSpawnId).toBe("natural-directed-prey");
        expect((replacement.predator ?? replacement.fauna)?.home).toEqual(replacement.position);
        if (replacement.predator) {
          expect(replacement.predator.packId).toBe("original-small-hunter-pack");
          expect(replacement.predator.state).toBe("rest");
          expect(replacement.predator.targetId).toBeUndefined();
        } else expect(replacement.fauna?.groupId).toBe("original-small-prey-group");
      }
    });
});

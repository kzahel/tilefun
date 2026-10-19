import { describe, expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { EntityManager } from "../entities/EntityManager.js";
import { createPlayer } from "../entities/Player.js";
import { decodeActor, durableId, encodeActor } from "../persistence/ActorRecords.js";
import { createDeer } from "./Deer.js";
import { createFauna, FAUNA_PROFILES } from "./Fauna.js";
import { canEat, creatureSpecies, FOOD_WEB, HUNTING_DIETS } from "./FoodWeb.js";
import { createPredator, PREDATOR_PROFILES } from "./Predator.js";
import { resolvePredatorCatches, updatePredatorAI } from "./predatorAI.js";
import { tickWildlifeRespawns } from "./WildlifeRespawns.js";

const open = { canOccupy: () => true, isWater: () => false, surfaceZ: () => 0 };
describe("explicit creature food web", () => {
  it("covers every wildlife profile, has no self/companion meals and no mutual-hunt cycles", () => {
    for (const p of FAUNA_PROFILES)
      expect(FOOD_WEB.some((r) => r.species === p.species)).toBe(true);
    for (const p of PREDATOR_PROFILES) expect(HUNTING_DIETS).toHaveProperty(p.species);
    const bySpecies = new Map(FOOD_WEB.map((r) => [r.species, r]));
    const checked = new Set<string>();
    const visit = (species: string, path: string[]) => {
      expect(path, `${path.join(" → ")} → ${species}`).not.toContain(species);
      if (checked.has(species)) return;
      const row = required(bySpecies.get(species));
      for (const prey of row.eats) {
        expect(required(bySpecies.get(prey)).protected).toBe(false);
        visit(prey, [...path, species]);
      }
      checked.add(species);
    };
    for (const row of FOOD_WEB) visit(row.species, []);
  });
  it("T. rex can eat a dire wolf, but wolves cannot eat a T. rex or players/pets/riders", () => {
    const rex = createPredator("t-rex", 0, 0);
    const wolf = createPredator("dire-wolf", 40, 0);
    expect(canEat(rex, wolf)).toBe(true);
    expect(canEat(wolf, rex)).toBe(false);
    expect(canEat(rex, rex)).toBe(false);
    expect(canEat(rex, createPlayer(0, 0))).toBe(false);
    for (const p of FAUNA_PROFILES.filter(
      (p) => p.variantOf || ["cat", "dog", "hamster", "guinea-pig"].includes(p.species),
    ))
      expect(canEat(rex, createFauna(p.species, 30, 0))).toBe(false);
    for (const species of ["horse", "donkey", "mule", "camel"] as const) {
      const mount = createFauna(species, 24, 0);
      expect(canEat(rex, mount)).toBe(true);
      required(mount.wanderAI).state = "ridden";
      expect(canEat(rex, mount)).toBe(false);
    }
    const deer = createDeer(20, 0);
    required(deer.wanderAI).following = true;
    expect(canEat(rex, deer)).toBe(false);
  });
  it("replaces an eaten natural predator, establishes a distant home and resets its old hunt", () => {
    const manager = new EntityManager();
    const rex = manager.spawn(createPredator("t-rex", 0, 0));
    const panther = manager.spawn(createPredator("panther", 36, 0));
    panther.naturalSpawnId = "world-panther";
    required(panther.predator).home = { wx: 100, wy: 100 };
    required(panther.predator).packId = "original-group";
    Object.assign(required(rex.predator), {
      state: "pounce",
      elapsed: 0.5,
      targetId: durableId(panther),
    });
    resolvePredatorCatches(manager, [...manager.entities], open, []);
    tickWildlifeRespawns(manager, 120, open, []);
    const replacement = required(manager.entities.find((e) => e.type === panther.type));
    expect(replacement.naturalSpawnId).toBe("world-panther");
    expect(replacement.predator?.home).toEqual(replacement.position);
    expect(replacement.predator?.packId).toBe("original-group");
    expect(replacement.predator?.targetId).toBeUndefined();
    expect(replacement.predator?.cooldown).toBeGreaterThan(0);
    expect(replacement.persistentId).not.toBe(panther.persistentId);
    expect(creatureSpecies(decodeActor(encodeActor(replacement)))).toBe("panther");
  });
  it("a predator eaten earlier in the same catch pass cannot consume its own target", () => {
    const manager = new EntityManager();
    const rex = manager.spawn(createPredator("t-rex", 0, 0));
    const panther = manager.spawn(createPredator("panther", 35, 0));
    const deer = manager.spawn(createDeer(55, 0));
    Object.assign(required(rex.predator), {
      state: "pounce",
      elapsed: 0.5,
      targetId: durableId(panther),
    });
    Object.assign(required(panther.predator), {
      state: "pounce",
      elapsed: 0.5,
      targetId: durableId(deer),
    });
    resolvePredatorCatches(manager, [...manager.entities], open, []);
    expect(manager.byId.has(panther.id)).toBe(false);
    expect(manager.byId.has(deer.id)).toBe(true);
    expect(rex.predator?.meals).toBe(1);
    expect(panther.predator?.meals).toBe(0);
  });
  it("roars before winding up, scares edible predators and limits its charge duration", () => {
    const rex = createPredator("t-rex", 0, 0),
      panther = createPredator("panther", 70, 0);
    required(rex.predator).timer = 0;
    updatePredatorAI(rex, 0.1, open, [rex, panther], []);
    expect(rex.predator?.state).toBe("display");
    expect(rex.velocity).toEqual({ vx: 0, vy: 0 });
    expect(panther.predator?.state).toBe("evade");
    updatePredatorAI(rex, 1.3, open, [rex, panther], []);
    expect(rex.predator?.state).toBe("windup");
    updatePredatorAI(rex, 0.8, open, [rex, panther], []);
    expect(rex.predator?.state).toBe("chase");
    updatePredatorAI(rex, 0.1, open, [rex, panther], []);
    expect(Math.hypot(rex.velocity?.vx ?? 0, rex.velocity?.vy ?? 0)).toBe(88);
    updatePredatorAI(rex, 4.6, open, [rex, panther], []);
    expect(rex.predator?.state).toBe("rest");
    expect(rex.predator?.targetId).toBeUndefined();
    expect(rex.predator?.cooldown).toBeGreaterThanOrEqual(12);
  });
});

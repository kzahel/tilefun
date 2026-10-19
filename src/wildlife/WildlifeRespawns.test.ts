import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { EntityManager } from "../entities/EntityManager.js";
import { createPlayer } from "../entities/Player.js";
import { durableId } from "../persistence/ActorRecords.js";
import { FLAT_SCENARIO } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { createDeer } from "./Deer.js";
import { createPredator } from "./Predator.js";
import { resolvePredatorCatches } from "./predatorAI.js";
import { tickWildlifeRespawns, WILDLIFE_RESPAWN_LIMIT } from "./WildlifeRespawns.js";

const open = { canOccupy: () => true, isWater: () => false, surfaceZ: () => 0 };
function meal(natural = true) {
  const manager = new EntityManager(),
    hunter = manager.spawn(createPredator("tiger", 0, 0)),
    prey = manager.spawn(createDeer(24, 0));
  if (natural) prey.proceduralId = "original-world-deer";
  Object.assign(required(hunter.predator), {
    state: "pounce",
    elapsed: 0.5,
    targetId: durableId(prey),
  });
  resolvePredatorCatches(manager, [...manager.entities], open, []);
  return { manager, hunter, prey };
}
it("removes the meal immediately, waits the randomized delay, and returns a distant new individual once", () => {
  const { manager, hunter, prey } = meal();
  const job = required([...manager.wildlifeRespawns.values()][0]);
  expect(manager.byId.has(prey.id)).toBe(false);
  expect(job.remaining).toBeGreaterThanOrEqual(60);
  expect(job.remaining).toBeLessThanOrEqual(120);
  expect(manager.entities.filter((e) => e.deer)).toHaveLength(0);
  tickWildlifeRespawns(manager, job.remaining - 0.1, open, [hunter.position]);
  expect(manager.entities.filter((e) => e.deer)).toHaveLength(0);
  // The queue is independent of the hunter's lifetime.
  manager.remove(hunter.id);
  tickWildlifeRespawns(manager, 0.2, open, [{ wx: 0, wy: 0 }]);
  const replacement = required(manager.entities.find((e) => e.deer));
  expect(replacement.persistentId).not.toBe(prey.persistentId);
  expect(replacement.naturalSpawnId).toBe(prey.proceduralId);
  expect(replacement.proceduralId).toBeUndefined();
  const distance = Math.hypot(
    replacement.position.wx - prey.position.wx,
    replacement.position.wy - prey.position.wy,
  );
  expect(distance).toBeGreaterThanOrEqual(512);
  expect(distance).toBeLessThanOrEqual(1024);
  expect(Math.hypot(replacement.position.wx, replacement.position.wy)).toBeGreaterThanOrEqual(512);
  expect(replacement.deer?.home).toEqual(replacement.position);
  expect(manager.wildlifeRespawns.size).toBe(0);
  tickWildlifeRespawns(manager, 300, open, []);
  expect(manager.entities.filter((e) => e.deer)).toHaveLength(1);
});
it("retries blocked/unloaded terrain instead of spawning on unsafe ground", () => {
  const { manager } = meal();
  manager.canPlace = () => false;
  tickWildlifeRespawns(manager, 120, open, []);
  expect(manager.wildlifeRespawns.size).toBe(1);
  expect(manager.entities.some((e) => e.deer)).toBe(false);
  manager.canPlace = () => true;
  tickWildlifeRespawns(manager, 5, { ...open, isWater: () => true }, []);
  expect(manager.wildlifeRespawns.size).toBe(1);
  tickWildlifeRespawns(manager, 5, open, []);
  expect(manager.wildlifeRespawns.size).toBe(0);
  expect(manager.entities.some((e) => e.deer)).toBe(true);
});
it("manual animals stay gone and duplicate catches cannot queue duplicate returns", () => {
  const manual = meal(false);
  tickWildlifeRespawns(manual.manager, 300, open, []);
  expect(manual.manager.wildlifeRespawns.size).toBe(0);
  expect(manual.manager.entities.some((e) => e.deer)).toBe(false);
  const { manager } = meal();
  resolvePredatorCatches(manager, [...manager.entities], open, []);
  expect(manager.wildlifeRespawns.size).toBe(1);
});
it("bounds the pending queue without silently losing natural population", () => {
  const { manager } = meal();
  const job = required([...manager.wildlifeRespawns.values()][0]);
  for (let i = 1; i < WILDLIFE_RESPAWN_LIMIT; i++)
    manager.wildlifeRespawns.set(`fixture-${i}`, structuredClone(job));
  const hunter = manager.spawn(createPredator("tiger", 0, 0)),
    prey = manager.spawn(createDeer(24, 0));
  prey.naturalSpawnId = "another-deer";
  Object.assign(required(hunter.predator), {
    state: "pounce",
    elapsed: 0.5,
    targetId: durableId(prey),
  });
  resolvePredatorCatches(manager, [...manager.entities], open, []);
  expect(manager.byId.has(prey.id)).toBe(true);
  expect(manager.wildlifeRespawns.size).toBe(WILDLIFE_RESPAWN_LIMIT);
});
it("saves pending countdowns and atomically replaces their records with distant actors after reload", async () => {
  const hunter = createPredator("tiger", 0, 0),
    prey = createDeer(24, 0);
  prey.naturalSpawnId = "saved-deer";
  Object.assign(required(hunter.predator), {
    state: "pounce",
    elapsed: 0.5,
    targetId: durableId(prey),
  });
  const session = await ScenarioSession.create({
    version: 1,
    id: "delayed-wildlife-return",
    generation: FLAT_SCENARIO,
    player: createPlayer(0, 160),
    actors: [hunter, prey],
    props: [],
  });
  const range = { minCx: -5, maxCx: 5, minCy: -5, maxCy: 5 };
  try {
    await session.step({ dx: 0, dy: 0, jump: false, sprinting: false }, 1 / 60, range);
    const queue = () => session.realm.entityManager.wildlifeRespawns;
    expect(queue().size).toBe(1);
    const saved = structuredClone([...queue().values()]);
    await session.reload();
    expect([...queue().values()]).toEqual(saved);
    expect(session.realm.entityManager.entities.some((e) => e.deer)).toBe(false);
    // Step the real Realm clock through the complete delay on loaded terrain.
    for (let i = 0; i < 3700 && queue().size; i++)
      await session.step({ dx: 0, dy: 0, jump: false, sprinting: false }, 1 / 30, range);
    expect(queue().size).toBe(0);
    const replacement = required(session.realm.entityManager.entities.find((e) => e.deer));
    expect(replacement.naturalSpawnId).toBe("saved-deer");
    const id = replacement.persistentId;
    await session.reload();
    expect(queue().size).toBe(0);
    expect(session.realm.entityManager.entities.filter((e) => e.persistentId === id)).toHaveLength(
      1,
    );
  } finally {
    await session.close();
  }
}, 30_000);

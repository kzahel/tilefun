import { describe, expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { TerrainId } from "../autotile/TerrainId.js";
import { createBall } from "../entities/Ball.js";
import { EntityManager } from "../entities/EntityManager.js";
import { createPlayer } from "../entities/Player.js";
import { ProceduralActors } from "../generation/ProceduralActors.js";
import { NaturalLandscape } from "../generation/regional/NaturalLandscape.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { decodeActor, durableId, encodeActor } from "../persistence/ActorRecords.js";
import { tickBallPhysics } from "../physics/BallPhysics.js";
import { FLAT_SCENARIO } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { createDeer } from "./Deer.js";
import { createFauna } from "./Fauna.js";
import { createPredator, PREDATOR_PROFILES, predatorType } from "./Predator.js";
import { resolvePredatorCatches, startlePredator, updatePredatorAI } from "./predatorAI.js";
import { createRabbit } from "./Rabbit.js";

const open = { canOccupy: () => true, isWater: () => false, surfaceZ: () => 0 };
const idle = { dx: 0, dy: 0, sprinting: false, jump: false };
describe.each(PREDATOR_PROFILES)("$species hunting", (p) => {
  const setup = () => {
    const manager = new EntityManager();
    const hunter = manager.spawn(createPredator(p.species, 0, 0));
    const prey = manager.spawn(createDeer(21, 0));
    durableId(prey);
    Object.assign(required(hunter.predator), {
      state: "pounce",
      elapsed: 0.2,
      targetId: prey.persistentId,
    });
    return { manager, hunter, prey };
  };
  it("replaces a catch once, retains habitat, and excludes the removed prey from a second hunter", () => {
    const { manager, hunter, prey } = setup();
    prey.proceduralId = "generated-deer";
    const deleted = new Set<string>();
    new ProceduralActors(manager, deleted, () => {});
    required(prey.deer).herdId = "herd";
    const other = manager.spawn(createPredator(p.species, 0, 0));
    Object.assign(required(other.predator), hunter.predator);
    resolvePredatorCatches(manager, [...manager.entities], open, []);
    const replacement = required(manager.entities.find((e) => e.deer));
    expect(manager.entities.filter((e) => e.deer)).toHaveLength(1);
    expect(replacement.persistentId).not.toBe(prey.persistentId);
    expect(replacement.proceduralId).toBeUndefined();
    expect(deleted.has("generated-deer")).toBe(true);
    expect(replacement.deer?.home).toEqual(prey.deer?.home);
    expect(replacement.deer?.herdId).toBe("herd");
    expect(hunter.predator?.state).toBe("feed");
    expect(hunter.predator?.meals).toBe(1);
    expect(other.predator?.meals).toBe(0);
    manager.remove(replacement.id);
    resolvePredatorCatches(manager, [...manager.entities], open, []);
    expect(manager.entities.some((e) => e.deer)).toBe(false);
  });
  it.each(["wall", "water", "height", "no replacement"])("defers an unsafe catch: %s", (reason) => {
    const { manager, hunter, prey } = setup();
    if (reason === "height") prey.wz = 12;
    const env = {
      ...open,
      canOccupy: (_: unknown, point: { wx: number; wy: number }) =>
        reason === "no replacement" ? Math.hypot(point.wx, point.wy) < 30 : reason !== "wall",
      isWater: () => reason === "water",
    };
    resolvePredatorCatches(manager, [...manager.entities], env, []);
    expect(manager.byId.has(prey.id)).toBe(true);
    expect(hunter.predator?.meals).toBe(0);
  });
  it("targets only wild deer/rabbits, respects barriers, and a scare cancels the hunt", () => {
    const hunter = createPredator(p.species, 0, 0);
    const protectedAnimals = [
      createPlayer(16, 0),
      createFauna("cat", 18, 0),
      createFauna("sheep", 24, 0),
    ];
    required(hunter.predator).timer = 0;
    updatePredatorAI(hunter, 0.1, open, [hunter, ...protectedAnimals], []);
    expect(hunter.predator?.targetId).toBeUndefined();
    const rabbit = createRabbit(32, 0);
    required(hunter.predator).timer = 0;
    updatePredatorAI(hunter, 0.1, { ...open, canOccupy: () => false }, [hunter, rabbit], []);
    expect(hunter.predator?.targetId).toBeUndefined();
    required(hunter.predator).timer = 0;
    updatePredatorAI(hunter, 0.1, open, [hunter, rabbit], []);
    expect(hunter.predator?.targetId).toBe(rabbit.persistentId);
    startlePredator(hunter, { wx: 10, wy: 0 });
    expect(hunter.predator?.targetId).toBeUndefined();
    expect(hunter.predator?.state).toBe("scared");
    expect(hunter.velocity).toEqual({ vx: 0, vy: 0 });
    const saved = decodeActor(encodeActor(hunter));
    expect("predator" in saved && saved.predator).toEqual(hunter.predator);
  });
  it("a real ball ricochets and interrupts the hunt without killing the predator", () => {
    const { manager, hunter } = setup();
    const ball = manager.spawn(createBall(-13, 0));
    required(ball.velocity).vx = 100;
    tickBallPhysics(
      manager,
      0.01,
      () => 0,
      () => 0,
    );
    expect(hunter.predator?.state).toBe("scared");
    expect(hunter.predator?.targetId).toBeUndefined();
    expect(ball.velocity?.vx).toBeLessThan(0);
    expect(hunter.deathTimer).toBeUndefined();
  });
  it("hunts in the production Realm and reloads feeding/replacement without resurrection", async () => {
    const hunter = createPredator(p.species, 64, 64),
      prey = createDeer(88, 64);
    required(hunter.predator).timer = 0;
    required(prey.deer).timer = 20;
    const session = await ScenarioSession.create({
      version: 1,
      id: `predator-${p.species}`,
      generation: FLAT_SCENARIO,
      player: createPlayer(64, 160),
      props: [],
      actors: [hunter, prey],
      traffic: [],
    });
    try {
      const entities = () => session.realm.entityManager.entities;
      const original = required(entities().find((e) => e.deer)).persistentId;
      for (let i = 0; i < 600 && !entities().find((e) => e.predator)?.predator?.meals; i++)
        await session.step(idle);
      const fed = required(entities().find((e) => e.predator));
      expect(fed.predator?.meals).toBe(1);
      const replacement = required(entities().find((e) => e.deer));
      expect(replacement.persistentId).not.toBe(original);
      const saved = encodeActor(fed).state.predator;
      await session.reload();
      expect(entities().find((e) => e.type === predatorType(p.species))?.predator).toEqual(saved);
      expect(
        entities()
          .filter((e) => e.deer)
          .map((e) => e.persistentId),
      ).toEqual([replacement.persistentId]);
      session.realm.entityManager.remove(required(entities().find((e) => e.deer)).id);
      await session.reload();
      expect(entities().some((e) => e.deer)).toBe(false);
    } finally {
      await session.close();
    }
  }, 30000);
});

it("seeds a repeatable tiger beside an existing deer glade without changing old homes", () => {
  const n = new NaturalLandscape(regionalWorld(2026), "thicket");
  const placements = [];
  for (let y = -44; y < -40; y++)
    for (let x = -12; x < -8; x++) placements.push(...n.wildlife(x, y));
  const tiger = placements.find((p) => p.type === predatorType("tiger"));
  expect(tiger?.wx).toBeCloseTo(-2238.4897153377533);
  expect(tiger?.wy).toBeCloseTo(-10706.725368976593);
  expect(placements.filter((p) => p.deer).length).toBeGreaterThanOrEqual(2);
  expect(tiger?.predator?.home).toEqual({ wx: -2318.4897153377533, wy: -10770.725368976593 });
  expect(tiger && n.terrain(tiger.wx / 16, tiger.wy / 16)).toBe(TerrainId.Grass);
});

import { describe, expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { TerrainId } from "../autotile/TerrainId.js";
import { createBall } from "../entities/Ball.js";
import type { Entity } from "../entities/Entity.js";
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
import { startleRabbit } from "./rabbitInteractions.js";

const open = { canOccupy: () => true, isWater: () => false, surfaceZ: () => 0 };
const idle = { dx: 0, dy: 0, sprinting: false, jump: false };
describe.each(PREDATOR_PROFILES)("$species hunting", (p) => {
  const preyFactory = p.fierce?.kind === "spider" ? createRabbit : createDeer;
  const preyType = preyFactory(0, 0).type;
  const habitat = (e: Entity) => required(e.deer ?? e.rabbit);
  const setup = (factory = preyFactory) => {
    const manager = new EntityManager();
    const hunter = manager.spawn(createPredator(p.species, 0, 0));
    const prey = manager.spawn(factory(21, 0));
    prey.proceduralId = "world-prey";
    durableId(prey);
    Object.assign(required(hunter.predator), {
      state: "pounce",
      elapsed: 0.5,
      targetId: prey.persistentId,
    });
    return { manager, hunter, prey };
  };
  it("replaces a catch once, retains habitat, and excludes the removed prey from a second hunter", () => {
    const { manager, hunter, prey } = setup();
    prey.proceduralId = "generated-deer";
    const deleted = new Set<string>();
    new ProceduralActors(manager, deleted, () => {});
    if (prey.deer) prey.deer.herdId = "herd";
    const other = manager.spawn(createPredator(p.species, 0, 0));
    Object.assign(required(other.predator), hunter.predator);
    resolvePredatorCatches(manager, [...manager.entities], open, []);
    const replacement = required(manager.entities.find((e) => e.type === preyType));
    expect(manager.entities.filter((e) => e.type === preyType)).toHaveLength(1);
    expect(replacement.persistentId).not.toBe(prey.persistentId);
    expect(replacement.proceduralId).toBeUndefined();
    expect(replacement.naturalSpawnId).toBe("generated-deer");
    expect(deleted.has("generated-deer")).toBe(true);
    expect(habitat(replacement).home).toEqual(habitat(prey).home);
    if (replacement.deer) expect(replacement.deer.herdId).toBe("herd");
    expect(hunter.predator?.state).toBe("feed");
    expect(hunter.predator?.meals).toBe(1);
    expect(other.predator?.meals).toBe(0);
    manager.remove(replacement.id);
    resolvePredatorCatches(manager, [...manager.entities], open, []);
    expect(manager.entities.some((e) => e.type === preyType)).toBe(false);
  });
  it("replaces a rabbit in its own habitat and leaves an airborne rabbit alive", () => {
    const { manager, hunter, prey } = setup(createRabbit);
    prey.position.wx = 17;
    required(prey.rabbit).state = "hop";
    prey.wz = 3;
    resolvePredatorCatches(manager, [...manager.entities], open, []);
    expect(manager.byId.has(prey.id)).toBe(true);
    required(prey.rabbit).state = "rest";
    prey.wz = 0;
    resolvePredatorCatches(manager, [...manager.entities], open, []);
    const replacement = required(manager.entities.find((e) => e.rabbit));
    expect(replacement.persistentId).not.toBe(prey.persistentId);
    expect(replacement.rabbit?.home).toEqual(prey.rabbit?.home);
    expect(hunter.predator?.meals).toBe(1);
    expect(manager.entities.filter((e) => e.rabbit)).toHaveLength(1);
  });
  it("eats player-created prey without replacing it or requiring a replacement site", () => {
    const { manager, hunter, prey } = setup();
    delete prey.proceduralId;
    const saved = decodeActor(encodeActor(prey)) as typeof prey;
    expect(saved.naturalSpawnId).toBeUndefined();
    resolvePredatorCatches(
      manager,
      [...manager.entities],
      {
        ...open,
        canOccupy: (_e, point) => Math.hypot(point.wx, point.wy) < 30,
      },
      [],
    );
    expect(manager.entities.some((e) => e.type === preyType)).toBe(false);
    expect(hunter.predator?.meals).toBe(1);
  });
  it("retains natural lineage after reload and replaces a second generation exactly once", () => {
    const { manager, hunter, prey } = setup();
    resolvePredatorCatches(manager, [...manager.entities], open, []);
    const first = required(manager.entities.find((e) => e.type === preyType));
    const saved = encodeActor(first);
    const reloaded = decodeActor(saved) as typeof first;
    expect(reloaded.naturalSpawnId).toBe("world-prey");
    expect(reloaded.proceduralId).toBeUndefined();
    manager.remove(first.id);
    reloaded.position = { ...prey.position };
    manager.spawn(reloaded);
    Object.assign(required(hunter.predator), {
      state: "pounce",
      elapsed: 0.5,
      targetId: reloaded.persistentId,
    });
    resolvePredatorCatches(manager, [...manager.entities], open, []);
    const second = required(manager.entities.find((e) => e.type === preyType));
    expect(second.naturalSpawnId).toBe("world-prey");
    expect(second.persistentId).not.toBe(reloaded.persistentId);
    expect(hunter.predator?.meals).toBe(2);
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
  it("protects players and companions, respects barriers, and a scare cancels the hunt", () => {
    const hunter = createPredator(p.species, 0, 0);
    const protectedAnimals = [
      createPlayer(16, 0),
      createFauna("cat", 18, 0),
      createFauna("dog", 24, 0),
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
    const ball = manager.spawn(createBall(-required(hunter.collider).width / 2 - 2, 0));
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
  it("catches already fleeing legal prey without lunging too early or pausing pursuit", async () => {
    const hunter = createPredator(p.species, 64, 64),
      prey = preyFactory(92, 64);
    Object.assign(required(hunter.predator), {
      state: "chase",
      timer: 0,
      targetId: durableId(prey),
    });
    if (prey.rabbit) startleRabbit(prey, { wx: 60, wy: 64 });
    else
      Object.assign(required(prey.deer), {
        state: "flee",
        target: { wx: 192, wy: 64 },
        motion: { elapsed: 0, duration: 5, escaping: true },
      });
    const session = await ScenarioSession.create({
      version: 1,
      id: `moving-prey-${p.species}`,
      generation: FLAT_SCENARIO,
      player: createPlayer(64, 160),
      props: [],
      actors: [hunter, prey],
    });
    try {
      for (
        let i = 0;
        i < 150 && !session.realm.entityManager.entities.find((e) => e.predator)?.predator?.meals;
        i++
      )
        await session.step(idle);
      expect(session.realm.entityManager.entities.find((e) => e.predator)?.predator?.meals).toBe(1);
    } finally {
      await session.close();
    }
  });
  it("hunts in the production Realm and reloads feeding/replacement without resurrection", async () => {
    const hunter = createPredator(p.species, 64, 64),
      prey = preyFactory(88, 64);
    prey.naturalSpawnId = `world-prey-${p.species}`;
    required(hunter.predator).timer = 0;
    habitat(prey).timer = 20;
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
      const original = required(entities().find((e) => e.type === preyType)).persistentId;
      for (let i = 0; i < 600 && !entities().find((e) => e.predator)?.predator?.meals; i++)
        await session.step(idle);
      const fed = required(entities().find((e) => e.predator));
      expect(fed.predator?.meals).toBe(1);
      const replacement = required(entities().find((e) => e.type === preyType));
      expect(replacement.persistentId).not.toBe(original);
      const saved = encodeActor(fed).state.predator;
      await session.reload();
      expect(entities().find((e) => e.type === predatorType(p.species))?.predator).toEqual(saved);
      expect(
        entities()
          .filter((e) => e.type === preyType)
          .map((e) => e.persistentId),
      ).toEqual([replacement.persistentId]);
      session.realm.entityManager.remove(required(entities().find((e) => e.type === preyType)).id);
      await session.reload();
      expect(entities().some((e) => e.type === preyType)).toBe(false);
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

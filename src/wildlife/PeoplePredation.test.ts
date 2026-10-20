import { describe, expect, it } from "vitest";
import { MANUAL_PREY_PAIRS } from "../../tests-support/ManualPreyPairs.fixture.js";
import { required } from "../art/ArtCatalog.js";
import { applyPlayerModel, PLAYER_MODELS } from "../characters/PlayerModels.js";
import { CHARACTER_FACTORIES } from "../characters/PromotedCharacters.js";
import { createBall } from "../entities/Ball.js";
import { ENTITY_FACTORIES } from "../entities/EntityFactories.js";
import { EntityManager } from "../entities/EntityManager.js";
import { createPerson1 } from "../entities/Person.js";
import { createPlayer } from "../entities/Player.js";
import { updateWanderAI } from "../entities/wanderAI.js";
import { ProceduralActors } from "../generation/ProceduralActors.js";
import { durableId } from "../persistence/ActorRecords.js";
import { tickBallPhysics } from "../physics/BallPhysics.js";
import { FLAT_SCENARIO } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { canEat } from "./FoodWeb.js";
import { createPredator, PREDATOR_PROFILES } from "./Predator.js";
import { resolvePredatorCatches, updatePredatorAI } from "./predatorAI.js";

const open = { canOccupy: () => true, isWater: () => false, surfaceZ: () => 0 };
const idle = { dx: 0, dy: 0, sprinting: false, jump: false };
const people = [
  ...Array.from({ length: 20 }, (_, i) => `person${i + 1}`),
  "character-person-v1",
  "indoor-reader",
  "indoor-diner",
  "indoor-cleaner",
  "indoor-chef",
];
const largeHunters = [
  "t-rex",
  "small-dragon",
  "brown-bear",
  "polar-bear",
  "lion",
  "tiger",
  "panther",
  "jaguar",
  "leopard",
  "wolf",
  "spotted-hyena",
  "dire-wolf",
  "griffin",
];

describe("NPC people as prey", () => {
  it("admits every NPC person only for explicitly listed large hunters", () => {
    for (const profile of PREDATOR_PROFILES) {
      const hunter = createPredator(profile.species, 0, 0);
      for (const type of people) {
        const person = required(ENTITY_FACTORIES[type])(24, 0);
        expect(canEat(hunter, person), `${profile.species} → ${type}`).toBe(
          largeHunters.includes(profile.species),
        );
      }
    }
    const rex = createPredator("t-rex", 0, 0);
    for (const [type, factory] of Object.entries(CHARACTER_FACTORIES))
      expect(canEat(rex, factory(24, 0)), type).toBe(type === "character-person-v1");
  });

  it("protects controlled players in every character appearance at selection and catch time", () => {
    for (const profile of PREDATOR_PROFILES) {
      const manager = new EntityManager();
      const hunter = manager.spawn(createPredator(profile.species, 0, 0));
      for (const model of PLAYER_MODELS) {
        const player = manager.spawn(createPlayer(16, 0));
        applyPlayerModel(player, model.id);
        expect(player.type).toBe("player");
        expect(canEat(hunter, player), `${profile.species} → player wearing ${model.id}`).toBe(
          false,
        );
        Object.assign(required(hunter.predator), {
          state: "rest",
          timer: 0,
          cooldown: 0,
          targetId: undefined,
        });
        updatePredatorAI(hunter, 0.1, open, [hunter, player], [player.position]);
        expect(hunter.predator?.targetId).toBeUndefined();
        // A stale or forged target must still fail the authoritative catch check.
        Object.assign(required(hunter.predator), {
          state: "pounce",
          elapsed: 0.5,
          targetId: durableId(player),
        });
        resolvePredatorCatches(manager, [...manager.entities], open, [player.position]);
        expect(manager.byId.has(player.id)).toBe(true);
        expect(hunter.predator?.meals).toBe(0);
        manager.remove(player.id);
      }
    }
  });

  it("people flee at a catchable pace; calming down and ball hits clear that override", () => {
    const manager = new EntityManager();
    const hunter = manager.spawn(createPredator("tiger", 0, 0));
    const person = manager.spawn(createPerson1(40, 0));
    Object.assign(required(hunter.predator), {
      state: "chase",
      timer: 0,
      targetId: durableId(person),
    });
    updatePredatorAI(hunter, 1 / 60, open, manager.entities, []);
    updateWanderAI(person, 1 / 60, () => 0.5);
    expect(person.wanderAI?.state).toBe("scared");
    expect(person.velocity).toEqual({ vx: 30, vy: 0 });
    updateWanderAI(person, 2, () => 0.5);
    expect(person.wanderAI?.state).toBe("idle");
    expect(person.wanderAI?.scaredSpeed).toBeUndefined();
    updatePredatorAI(hunter, 1 / 60, open, manager.entities, []);
    expect(person.wanderAI?.scaredSpeed).toBe(30);
    const ball = manager.spawn(createBall(33, 0));
    required(ball.velocity).vx = 100;
    tickBallPhysics(
      manager,
      0.01,
      () => 0,
      () => 0,
    );
    expect(person.wanderAI?.scaredSpeed).toBeUndefined();
    updateWanderAI(person, 1 / 60, () => 0.5);
    expect(Math.hypot(person.velocity?.vx ?? 0, person.velocity?.vy ?? 0)).toBe(60);
  });

  it.each(people)("catches %s once without queuing a wildlife replacement", (type) => {
    const manager = new EntityManager();
    const deleted = new Set<string>();
    new ProceduralActors(manager, deleted, () => {});
    const hunter = manager.spawn(createPredator("t-rex", 0, 0));
    const person = manager.spawn(required(ENTITY_FACTORIES[type])(30, 0));
    person.proceduralId = "town-person";
    Object.assign(required(hunter.predator), {
      state: "pounce",
      elapsed: 0.5,
      targetId: durableId(person),
    });
    resolvePredatorCatches(manager, [...manager.entities], open, []);
    expect(manager.byId.has(person.id)).toBe(false);
    expect(deleted.has("town-person")).toBe(true);
    expect(manager.wildlifeRespawns.size).toBe(0);
    expect(hunter.predator?.meals).toBe(1);
    expect(hunter.predator?.state).toBe("feed");
    resolvePredatorCatches(manager, [...manager.entities], open, []);
    expect(hunter.predator?.meals).toBe(1);
  });

  it.each(["following", "attached", "height", "jump", "wall", "water"])(
    "retains the existing prey protection for %s people",
    (reason) => {
      const manager = new EntityManager();
      const hunter = manager.spawn(createPredator("t-rex", 0, 0));
      const person = manager.spawn(createPerson1(30, 0));
      if (reason === "following") required(person.wanderAI).following = true;
      if (reason === "attached") person.parentId = hunter.id;
      if (reason === "height") person.wz = 12;
      if (reason === "jump") person.jumpZ = 8;
      Object.assign(required(hunter.predator), {
        state: "pounce",
        elapsed: 0.5,
        targetId: durableId(person),
      });
      resolvePredatorCatches(
        manager,
        [...manager.entities],
        {
          ...open,
          canOccupy: () => reason !== "wall",
          isWater: () => reason === "water",
        },
        [],
      );
      expect(manager.byId.has(person.id)).toBe(true);
      expect(hunter.predator?.meals).toBe(0);
    },
  );

  it.each(
    (["t-rex", "small-dragon", "brown-bear", "lion", "tiger"] as const).flatMap((species) =>
      ["person1", "character-person-v1", "indoor-reader"].map((type) => ({ species, type })),
    ),
  )(
    "$species hunts $type in shared Realm authority and preserves the meal through reload",
    async ({ species, type }) => {
      const hunter = createPredator(species, 64, 64);
      required(hunter.predator).timer = 0;
      const person = required(ENTITY_FACTORIES[type])(98, 64);
      if (type === "indoor-reader")
        person.resident = {
          homeRealm: "home",
          parentRealm: "scenario",
          doorId: "front-door",
          place: "outside",
          inside: [],
          outside: [{ id: "rest", wx: 98, wy: 64, action: "rest", seconds: 60 }],
          index: 0,
          phase: "act",
          elapsed: 0,
          retry: 0,
          path: [],
        };
      const id = durableId(person);
      const player = createPlayer(64, 160);
      applyPlayerModel(player, "person1");
      const session = await ScenarioSession.create({
        version: 1,
        id: `npc-meal-${species}`,
        generation: FLAT_SCENARIO,
        player,
        actors: [hunter, person],
        props: [],
      });
      const actors = () => session.realm.entityManager.entities;
      const predator = () => required(actors().find((e) => e.predator));
      try {
        for (let i = 0; i < 900 && !predator().predator?.meals; i++) await session.step(idle);
        expect(
          predator().predator?.meals,
          JSON.stringify(
            actors().map((e) => ({ type: e.type, p: e.position, ai: e.predator ?? e.wanderAI })),
          ),
        ).toBe(1);
        expect(actors().some((e) => e.persistentId === id)).toBe(false);
        expect(actors().filter((e) => e.type === "player")).toHaveLength(1);
        expect(session.realm.entityManager.wildlifeRespawns.size).toBe(0);
        await session.reload();
        expect(predator().predator?.meals).toBe(1);
        expect(actors().some((e) => e.persistentId === id)).toBe(false);
        expect(session.player.player.type).toBe("player");
      } finally {
        await session.close();
      }
    },
  );
});

it.each(MANUAL_PREY_PAIRS)(
  "editor-placed $name is consumed once and stays absent after reload",
  async ({ prey, hunter }) => {
    const session = await ScenarioSession.create({
      version: 1,
      id: `manual-prey-${prey}`,
      generation: FLAT_SCENARIO,
      player: createPlayer(64, 64),
      props: [],
    });
    try {
      session.player.editorEnabled = true;
      // Appearance selection is owned by GameServer; retain its real browser path.
      applyPlayerModel(session.player.player, "person1");
      for (const [type, x] of [
        [hunter, 112],
        [prey, 160],
      ] as const)
        session.realm.handleMessage(session.player.clientId, session.player, {
          type: "edit-spawn",
          entityType: type,
          wx: x,
          wy: 64,
        });
      session.player.editorEnabled = false;
      await session.ready();
      const population = () => session.realm.entityManager.entities;
      const victim = required(population().find((e) => e.type === prey));
      const id = durableId(victim);
      expect(population().filter((e) => e.type === prey)).toHaveLength(1);
      expect(population().filter((e) => e.type === hunter)).toHaveLength(1);
      for (let tick = 0; tick < 1200 && population().some((e) => e.type === prey); tick++)
        await session.step(idle);
      expect(population().some((e) => e.type === prey)).toBe(false);
      expect(population().filter((e) => e.type === hunter)).toHaveLength(1);
      expect(session.realm.entityManager.wildlifeRespawns.size).toBe(0);
      expect(session.player.player.type).toBe("player");
      expect(session.player.player.playerModel).toBe("person1");
      await session.reload();
      expect(population().some((e) => durableId(e) === id || e.type === prey)).toBe(false);
      expect(population().filter((e) => e.type === hunter)).toHaveLength(1);
      expect(session.realm.entityManager.wildlifeRespawns.size).toBe(0);
    } finally {
      await session.close();
    }
  },
);

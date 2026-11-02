import { expect, it } from "vitest";
import { PlayerPredictor } from "../../client/PlayerPredictor.js";
import { ENTITY_FACTORIES } from "../../entities/EntityFactories.js";
import { createPlayer } from "../../entities/Player.js";
import { FlatStrategy } from "../../generation/FlatStrategy.js";
import type { Movement } from "../../input/ActionManager.js";
import { FLAT_SCENARIO } from "../../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../../scenarios/ScenarioSession.js";
import { createFauna } from "../../wildlife/Fauna.js";
import { World } from "../../world/World.js";
import { CharacterMotionBudget } from "../CharacterMotionBudget.js";
import { prepareCharacterPhysics } from "../CharacterPhysics.js";
import { getMovementPhysicsParams, stepPlayerFromInput } from "../PlayerMovement.js";
import { createMovementContext, createSurfaceSampler } from "../SimulationEnvironment.js";

const idle: Movement = { dx: 0, dy: 0, jump: false, sprinting: false };
it("retains legacy NPC pushing while leaving capsule clearance to the selected solver", async () => {
  for (const mode of [0, 2] as const) {
    const npc = ENTITY_FACTORIES.chicken?.(32, 32);
    if (!npc?.wanderAI) throw Error("Missing chicken fixture");
    npc.wanderAI.timer = 100;
    const session = await ScenarioSession.create({
      version: 1,
      id: `npc-contact-owner-${mode}`,
      generation: FLAT_SCENARIO,
      player: createPlayer(40.1, 32),
      actors: [npc],
      props: [],
      physics: { characterPhysics: mode },
    });
    try {
      const actor = session.realm.entityManager.entities.find((e) => e.type === "chicken");
      if (!actor) throw Error("Missing chicken");
      for (let tick = 0; tick < 30; tick++) await session.step(idle, 0.017);
      const drift = Math.hypot(actor.position.wx - 32, actor.position.wy - 32);
      if (mode === 0) expect(drift).toBeGreaterThan(1);
      else expect(drift).toBeLessThan(0.01);
    } finally {
      await session.close();
    }
  }
});
it.each(["chicken", "person1"])(
  "supports landing on an idle %s through the real Realm NPC update",
  async (type) => {
    for (const mode of [1, 2] as const) {
      const factory = ENTITY_FACTORIES[type];
      if (!factory) throw Error("Missing NPC factory");
      const npc = factory(32, 32),
        player = createPlayer(33, 32);
      if (!npc.wanderAI || !npc.collider) throw Error("Missing NPC components");
      npc.wanderAI.timer = 100;
      player.wz = (npc.collider.physicalHeight ?? 0) + 20;
      player.jumpVZ = 0;
      const session = await ScenarioSession.create({
        version: 1,
        id: `head-${type}-${mode}`,
        generation: FLAT_SCENARIO,
        player,
        actors: [npc],
        props: [],
        physics: { characterPhysics: mode },
      });
      try {
        const actor = session.realm.entityManager.entities.find((e) => e.type === type);
        if (!actor) throw Error("Missing NPC");
        let drift = 0,
          minHeight = Infinity;
        for (let tick = 0; tick < 120; tick++) {
          await session.step(idle, 0.017);
          drift = Math.max(drift, Math.hypot(actor.position.wx - 32, actor.position.wy - 32));
          if (tick > 60)
            minHeight = Math.min(minHeight, (session.player.player.wz ?? 0) - (actor.wz ?? 0));
        }
        expect(drift).toBeLessThan(0.01);
        expect(minHeight).toBeGreaterThan((npc.collider.physicalHeight ?? 0) - 0.1);
      } finally {
        await session.close();
      }
    }
  },
);
it("lands and stands on a player's head in either motor processing order", async () => {
  await prepareCharacterPhysics(1);
  for (const mode of [1, 2] as const)
    for (const riderFirst of [false, true]) {
      const base = createPlayer(0, 32),
        rider = createPlayer(1, 32);
      base.id = 1;
      rider.id = 2;
      rider.wz = 28;
      rider.jumpVZ = 0;
      const actors = [base, rider],
        budget = new CharacterMotionBudget();
      const source = {
        getCollision: () => 0,
        getHeight: () => 0,
        queryEntities: () => actors,
        queryProps: () => [],
        noclip: false,
        motionBudget: budget,
        pushBody: (before: typeof base, after: typeof base) => Object.assign(before, after),
      };
      const contexts = actors.map((movingEntity) =>
        createMovementContext({ ...source, movingEntity, excludeIds: new Set([movingEntity.id]) }),
      );
      const states = [
        { jumpConsumed: false, lastJumpHeld: false },
        { jumpConsumed: false, lastJumpHeld: false },
      ];
      const sample = createSurfaceSampler(source),
        physics = { ...getMovementPhysicsParams(), characterPhysics: mode };
      let drift = 0,
        minHeight = Infinity;
      for (let tick = 0; tick < 180; tick++) {
        budget.clear();
        for (const seat of riderFirst ? [1, 0] : [0, 1]) {
          const actor = actors[seat],
            ctx = contexts[seat],
            state = states[seat];
          if (!actor || !ctx || !state) throw Error("Missing actor");
          states[seat] = stepPlayerFromInput(
            actor,
            idle,
            1 / 60,
            ctx,
            () => 0,
            sample,
            state,
            physics,
          ).jumpState;
        }
        drift = Math.max(drift, Math.hypot(base.position.wx, base.position.wy - 32));
        if (tick > 60) minHeight = Math.min(minHeight, (rider.wz ?? 0) - (base.wz ?? 0));
      }
      expect(drift).toBeLessThan(0.01);
      expect(minHeight).toBeGreaterThan(11);
    }
});
it("does not transfer rider walking to a supporting player when both motors are processed", async () => {
  await prepareCharacterPhysics(1);
  for (const mode of [1, 2] as const)
    for (const riderFirst of [false, true]) {
      const base = createPlayer(0, 32),
        rider = createPlayer(mode === 1 ? -4 : -5.6, 32);
      base.id = 1;
      rider.id = 2;
      rider.wz = mode === 1 ? 12 : 6 + Math.sqrt(36 - 5.6 ** 2) + 0.05;
      const actors = [base, rider],
        budget = new CharacterMotionBudget();
      const source = {
        getCollision: () => 0,
        getHeight: () => 0,
        queryEntities: () => actors,
        queryProps: () => [],
        noclip: false,
        motionBudget: budget,
        pushBody: (before: typeof base, after: typeof base) => Object.assign(before, after),
      };
      const contexts = actors.map((movingEntity) =>
        createMovementContext({ ...source, movingEntity, excludeIds: new Set([movingEntity.id]) }),
      );
      const states = [
        { jumpConsumed: false, lastJumpHeld: false },
        { jumpConsumed: false, lastJumpHeld: false },
      ];
      const sample = createSurfaceSampler(source),
        physics = { ...getMovementPhysicsParams(), characterPhysics: mode };
      for (let tick = 0; tick < 20; tick++) {
        budget.clear();
        for (const seat of riderFirst ? [1, 0] : [0, 1]) {
          const actor = actors[seat],
            ctx = contexts[seat],
            state = states[seat];
          if (!actor || !ctx || !state) throw Error("Missing actor");
          states[seat] = stepPlayerFromInput(
            actor,
            seat === 1 ? { ...idle, dx: 1 } : idle,
            1 / 60,
            ctx,
            () => 0,
            sample,
            state,
            physics,
          ).jumpState;
        }
      }
      expect(Math.hypot(base.position.wx, base.position.wy - 32)).toBeLessThan(0.01);
      expect(rider.position.wx).toBeGreaterThan(mode === 1 ? 3 : 0);
    }
});
it("preserves actual horse landing and authority mounting side effects", async () => {
  const player = createPlayer(32, 32),
    horse = createFauna("horse", 32, 32);
  player.wz = 30;
  player.jumpVZ = 0;
  horse.wanderAI = null;
  const session = await ScenarioSession.create({
    version: 1,
    id: "rapier-horse",
    generation: FLAT_SCENARIO,
    player,
    actors: [horse],
    props: [],
    physics: { characterPhysics: 1 },
  });
  try {
    for (let tick = 0; tick < 40 && session.player.gameplaySession.mountId === null; tick++) {
      await session.step(idle, 0.017);
    }
    const mount = session.realm.entityManager.entities.find((e) => e.type === horse.type);
    expect(mount).toBeDefined();
    expect(session.player.gameplaySession.mountId).toBe(mount?.id);
    expect(session.player.player.parentId).toBe(mount?.id);
  } finally {
    await session.close();
  }
});
it("uses the real Realm and normal predictor, including retained per-input hull/gravity settings", async () => {
  const session = await ScenarioSession.create({
    version: 1,
    id: "game-rapier",
    generation: FLAT_SCENARIO,
    player: createPlayer(0, 0),
    props: [],
    physics: { characterPhysics: 1 },
  });
  const world = new World(new FlatStrategy());
  for (let x = -3; x <= 3; x++) for (let y = -3; y <= 3; y++) world.getChunk(x, y);
  let physics = { ...session.physics };
  const predictor = new PlayerPredictor(
    () => ({ ...physics }),
    () => 1,
    () => 0,
  );
  try {
    for (let tick = 0; tick < 20; tick++) await session.step({ ...idle, dx: 1 }, 0.017);
    const base = structuredClone(session.player.player),
      ack = session.player.lastProcessedInputSeq;
    predictor.reset(base);
    for (let tick = 1; tick <= 8; tick++) {
      if (tick === 4) {
        Object.assign(session.physics, { characterPhysics: 2, gravityScale: 0.5, revision: 2 });
        physics = { ...session.physics };
      }
      const input = { ...idle, dx: 1, jump: tick <= 2 };
      predictor.storeInput(ack + tick, input, 0.017);
      predictor.update(0.017, input, world, [], []);
      await session.step(input, 0.017);
    }
    const before = structuredClone(predictor.player);
    // The current getter now disagrees with retained commands. Replay must use
    // each submitted command's snapshot, not this newest setting.
    physics = { ...physics, characterPhysics: 1, gravityScale: 3, revision: 3 };
    predictor.reconcile(base, ack, world, [], []);
    expect(predictor.player?.position.wx).toBeCloseTo(before?.position.wx ?? 0, 3);
    expect(predictor.player?.wz).toBeCloseTo(before?.wz ?? 0, 3);
    expect(predictor.player?.position.wx).toBeCloseTo(session.player.player.position.wx, 2);
    expect(predictor.player?.wz).toBeCloseTo(session.player.player.wz ?? 0, 2);
    // Missing-input authority ticks must use the selected backend exactly once.
    session.tick(0.017);
    expect(session.player.player.wz).toBeGreaterThan(0);
  } finally {
    await session.close();
  }
});
it("bounds a push plus the recipient's own movement within the same authority interval", async () => {
  await prepareCharacterPhysics(1);
  const a = createPlayer(0, 32),
    b = createPlayer(10.1, 32);
  a.id = 1;
  b.id = 2;
  const entities = [a, b],
    budget = new CharacterMotionBudget();
  const physics = { ...getMovementPhysicsParams(), characterPhysics: 1 as const };
  const source = {
    getCollision: () => 0,
    getHeight: () => 0,
    queryEntities: () => entities,
    queryProps: () => [],
    noclip: false,
    motionBudget: budget,
    pushBody: (before: typeof a, after: typeof a) => {
      before.position = after.position;
      before.wz = after.wz ?? 0;
    },
  };
  const contexts = entities.map((player) =>
    createMovementContext({ ...source, movingEntity: player, excludeIds: new Set([player.id]) }),
  );
  const states = [
    { jumpConsumed: false, lastJumpHeld: false },
    { jumpConsumed: false, lastJumpHeld: false },
  ];
  const sample = createSurfaceSampler(source);
  for (let tick = 0; tick < 60; tick++) {
    budget.clear();
    const before = entities.map((p) => ({ ...p.position }));
    for (const seat of [0, 1] as const) {
      const player = entities[seat],
        context = contexts[seat],
        state = states[seat];
      if (!player || !context || !state) throw Error("Missing actor");
      states[seat] = stepPlayerFromInput(
        player,
        seat === 0 ? { ...idle, dx: 1 } : { ...idle, dy: 1 },
        1 / 60,
        context,
        () => 0,
        sample,
        state,
        physics,
      ).jumpState;
    }
    for (const seat of [0, 1] as const) {
      const p = entities[seat],
        old = before[seat];
      if (p && old)
        expect(Math.hypot(p.position.wx - old.wx, p.position.wy - old.wy) * 60).toBeLessThan(65);
    }
  }
});

it("rebases speculative on-foot push copies before replaying against new authority poses", async () => {
  await prepareCharacterPhysics(1);
  const world = new World(new FlatStrategy());
  for (let x = -2; x <= 2; x++) for (let y = -2; y <= 2; y++) world.getChunk(x, y);
  const player = createPlayer(0, 32),
    peer = createPlayer(16, 32);
  player.id = 1;
  peer.id = 2;
  const physics = { ...getMovementPhysicsParams(), characterPhysics: 1 as const };
  const predictor = new PlayerPredictor(
    () => ({ ...physics }),
    () => 1,
    () => 0,
  );
  predictor.reset(player);
  const input = { ...idle, dx: 1 };
  for (let seq = 1; seq <= 60; seq++) {
    predictor.storeInput(seq, input, 0.017);
    predictor.update(0.017, input, world, [], [peer]);
  }
  const authority = structuredClone(predictor.player);
  if (!authority) throw Error("Missing predicted player");
  const movedPeer = structuredClone(peer);
  movedPeer.position.wx = 200;
  predictor.reconcile(authority, 60, world, [], [movedPeer]);
  const reference = new PlayerPredictor(
    () => ({ ...physics }),
    () => 1,
    () => 0,
  );
  reference.reset(authority);
  for (let seq = 61; seq <= 90; seq++) {
    for (const p of [predictor, reference]) {
      p.storeInput(seq, input, 0.017);
      p.update(0.017, input, world, [], [movedPeer]);
    }
  }
  expect(predictor.player?.position.wx).toBeCloseTo(reference.player?.position.wx ?? 0, 2);
  expect(peer.position.wx).toBe(16); // replica input was never mutated
});

it("preserves push travel across physics subdivision and receiver processing order", async () => {
  await prepareCharacterPhysics(1);
  const results: number[] = [];
  for (const substeps of [1, 4])
    for (const receiverFirst of [false, true]) {
      const a = createPlayer(0, 32),
        b = createPlayer(10.1, 32);
      a.id = 1;
      b.id = 2;
      const entities = [a, b],
        budget = new CharacterMotionBudget();
      const physics = { ...getMovementPhysicsParams(), characterPhysics: 1 as const };
      const source = {
        getCollision: () => 0,
        getHeight: () => 0,
        queryEntities: () => entities,
        queryProps: () => [],
        noclip: false,
        motionBudget: budget,
        pushBody: (before: typeof a, after: typeof a) => {
          Object.assign(before, after);
        },
      };
      const contexts = entities.map((player) =>
        createMovementContext({
          ...source,
          movingEntity: player,
          excludeIds: new Set([player.id]),
        }),
      );
      const states = [
          { jumpConsumed: false, lastJumpHeld: false },
          { jumpConsumed: false, lastJumpHeld: false },
        ],
        sample = createSurfaceSampler(source);
      let finalTravelStart = 0;
      for (let tick = 0; tick < 40; tick++) {
        if (tick === 30) finalTravelStart = b.position.wx;
        budget.clear();
        for (const seat of receiverFirst ? [1, 0] : [0, 1]) {
          const player = entities[seat],
            context = contexts[seat],
            state = states[seat];
          if (!player || !context || !state) throw Error("Missing actor");
          states[seat] = stepPlayerFromInput(
            player,
            seat === 0 ? { ...idle, dx: 1 } : idle,
            1 / 60,
            context,
            () => 0,
            sample,
            state,
            physics,
            substeps,
          ).jumpState;
        }
      }
      expect(b.position.wx - finalTravelStart).toBeGreaterThan(4.5);
      results.push(b.position.wx - 10.1);
    }
  expect(Math.min(...results)).toBeGreaterThan(20);
  // Discrete contact admission may differ by less than one walking tick.
  expect(Math.max(...results) - Math.min(...results)).toBeLessThan(64 / 60);
  for (const offset of [0, 2])
    expect(Math.abs((results[offset] ?? NaN) - (results[offset + 1] ?? NaN))).toBeLessThan(0.15);
});

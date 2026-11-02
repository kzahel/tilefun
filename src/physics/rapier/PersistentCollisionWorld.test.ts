import { expect, it } from "vitest";
import { createBall } from "../../entities/Ball.js";
import { Direction } from "../../entities/Entity.js";
import { ENTITY_FACTORIES } from "../../entities/EntityFactories.js";
import { createPlayer } from "../../entities/Player.js";
import { FLAT_SCENARIO } from "../../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../../scenarios/ScenarioSession.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
it.each([3, 4] as const)(
  "retains realm sections, moves NPCs and supports/pushes them with mode %s",
  async (mode) => {
    const npc = ENTITY_FACTORIES.chicken?.(48, 32);
    if (!npc?.wanderAI) throw Error("Missing chicken");
    npc.wanderAI.timer = 100;
    const session = await ScenarioSession.create({
      version: 1,
      id: `persistent-${mode}`,
      generation: FLAT_SCENARIO,
      props: [],
      actors: [npc],
      player: createPlayer(32, 32),
      physics: { characterPhysics: mode },
    });

    try {
      const actor = session.realm.entityManager.entities.find((e) => e.type === "chicken");
      if (!actor) throw Error("Missing chicken");
      for (let i = 0; i < 45; i++) await session.step({ ...idle, dx: 1 }, 1 / 60);
      expect(actor.position.wx).toBeGreaterThan(49);
      const before = session.realm.collisionDiagnostics;
      for (let i = 0; i < 20; i++) await session.step(idle, 1 / 60);
      const after = session.realm.collisionDiagnostics;
      expect(after?.rebuiltSections).toBe(before?.rebuiltSections);
      expect(after?.queries).toBeGreaterThan(before?.queries ?? Infinity);
      expect(after?.sections).toBeLessThan(10);
      // An ordinary falling rider exercises the NPC update as well as the player.
      Object.assign(session.player.player.position, {
        wx: actor.position.wx + 1,
        wy: actor.position.wy,
      });
      session.player.player.wz = 28;
      session.player.player.jumpVZ = 0;
      const support = { ...actor.position };
      for (let i = 0; i < 120; i++) await session.step(idle, 1 / 60);
      expect(
        Math.hypot(actor.position.wx - support.wx, actor.position.wy - support.wy),
      ).toBeLessThan(0.1);
      expect(session.player.player.wz).toBeGreaterThan(7.8);
    } finally {
      await session.close();
    }
  },
);

it("drives an ordinary car into an NPC through replacement contacts and reconstructs after reload", async () => {
  const npc = ENTITY_FACTORIES.person1?.(120, 64);
  if (!npc?.wanderAI) throw Error("Missing person");
  npc.wanderAI.timer = 100;
  const session = await ScenarioSession.create({
    version: 1,
    id: "persistent-car",
    generation: FLAT_SCENARIO,
    props: [],
    actors: [npc],
    player: createPlayer(0, 64),
    parkedVehicles: [{ model: "compact-1", wx: 64, wy: 64, facing: Direction.Right }],
    physics: { characterPhysics: 3 },
  });
  try {
    const car = session.realm.entityManager.entities.find((e) => e.type.startsWith("vehicle-v1:"));
    const person = session.realm.entityManager.entities.find((e) => e.type === "person1");
    if (!car || !person) throw Error("Missing car/person");
    await session.command({ kind: "teleport", position: { wx: 32, wy: 64 } });
    await session.command({ kind: "enter-vehicle", entityId: car.id });
    for (let i = 0; i < 100; i++) await session.step({ ...idle, dx: 1 }, 1 / 60);
    expect(car.position.wx).toBeGreaterThan(80);
    expect(person.position.wx).toBeGreaterThan(121);
    await session.command({ kind: "exit-vehicle" });
    const expected = { ...car.position };
    await session.reload();
    const restored = session.realm.entityManager.entities.find((e) => e.type === car.type);
    expect(restored?.position.wx).toBeCloseTo(expected.wx, 2);
    await session.step(idle, 1 / 60);
    expect(session.realm.collisionDiagnostics?.queries).toBeGreaterThan(0);
  } finally {
    await session.close();
  }
});

it.each([3, 4] as const)(
  "uses one stable hull for an ordinary bouncing and rolling ball (mode %s)",
  async (mode) => {
    const ball = createBall(64, 32);
    ball.wz = 20;
    ball.jumpVZ = -5;
    ball.velocity = { vx: 30, vy: 0 };
    const session = await ScenarioSession.create({
      version: 1,
      id: "persistent-ball",
      generation: FLAT_SCENARIO,
      props: [],
      actors: [ball],
      player: createPlayer(32, 32),
      physics: { characterPhysics: mode },
    });
    try {
      const actor = session.realm.entityManager.entities.find((e) => e.type === "ball");
      if (!actor) throw Error("Missing ball");
      let bounced = false;
      for (let i = 0; i < 120; i++) {
        await session.step(idle, 1 / 60);
        bounced ||= (actor.jumpVZ ?? 0) > 5;
        expect(actor.wz).toBeGreaterThan(-0.1);
      }
      expect(bounced).toBe(true);
      expect(actor.position.wx).toBeGreaterThan(66);
      expect(actor.wz).toBeLessThan(0.2);
      expect(session.realm.collisionDiagnostics?.replacedActorShapes).toBe(0);
    } finally {
      await session.close();
    }
  },
);

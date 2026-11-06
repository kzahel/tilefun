import { expect, it } from "vitest";
import { createPlayer } from "../entities/Player.js";
import { encodeActor } from "../persistence/ActorRecords.js";
import { FLAT_SCENARIO } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { decodeServerMessage, encodeServerMessage } from "../shared/binaryCodec.js";
import { applyEntityDelta, diffEntitySnapshots } from "../shared/entityDelta.js";
import { required } from "../shared/required.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import { createMallard, MALLARD_TYPE } from "./Mallard.js";
import { updateMallardAI } from "./mallardAI.js";
import { startleMallard } from "./mallardInteractions.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
const open = { canOccupy: () => true, isWater: () => false, surfaceZ: () => 0 };
it("replicates the alarm state through both binary baselines and deltas", () => {
  const d = createMallard(64, 64),
    before = serializeEntity(d);
  startleMallard(d, { wx: 40, wy: 64 });
  const after = serializeEntity(d);
  const wire = decodeServerMessage(
    encodeServerMessage({
      type: "frame",
      serverTick: 1,
      lastProcessedInputSeq: 0,
      playerEntityId: 0,
      entityBaselines: [after],
      entityDeltas: [required(diffEntitySnapshots(before, after))],
    }),
  );
  if (wire.type !== "frame") throw new Error("Expected frame");
  expect(deserializeEntity(required(wire.entityBaselines?.[0])).wanderAI?.state).toBe("scared");
  const replica = deserializeEntity(before);
  applyEntityDelta(replica, required(wire.entityDeltas?.[0]));
  expect(replica.wanderAI?.state).toBe("scared");
  expect(replica.sprite?.clip).toBe(4);
});
function fallingPlayer() {
  const player = createPlayer(64, 64);
  player.id = 100;
  player.wz = 12;
  player.jumpVZ = -40;
  player.jumpZ = 12;
  return player;
}

it("quacks and settles in place when no safe escape exists", () => {
  const d = createMallard(64, 64);
  startleMallard(d, { wx: 50, wy: 64 });
  updateMallardAI(d, 0.65, { ...open, canOccupy: () => false }, [d], []);
  expect(d.mallard?.state).toBe("recover");
  expect(d.position).toEqual({ wx: 64, wy: 64 });
  updateMallardAI(d, 2.1, open, [d], []);
  expect(d.mallard?.state).toBe("rest");
});

it("a real throw clears its owner, hits a duck, and preserves the duck through escape", async () => {
  const s = await ScenarioSession.create({
    version: 1,
    id: "duck-ball",
    generation: FLAT_SCENARIO,
    player: createPlayer(64, 64),
    props: [],
    actors: [createMallard(120, 64)],
  });
  try {
    s.realm.handleMessage(s.player.clientId, s.player, {
      type: "throw-ball",
      dirX: 1,
      dirY: 0,
      force: 0,
    });
    await s.step(idle);
    expect(Math.abs(s.player.player.velocity?.vx ?? 0)).toBeLessThan(0.01);
    const states = new Set<string>();
    const duck = required(s.realm.entityManager.entities.find((e) => e.type === MALLARD_TYPE));
    for (let i = 0; i < 260; i++) {
      await s.step(idle);
      states.add(required(duck.mallard).state);
    }
    expect(states.has("startle")).toBe(true);
    expect(states.has("flight")).toBe(true);
    expect(states.has("recover")).toBe(true);
    expect(duck.deathTimer).toBeUndefined();
  } finally {
    await s.close();
  }
});

it.each([true, false])(
  "real Realm landing triggers one bounded escape and retains identity (input=%s)",
  async (input) => {
    const d = createMallard(64, 64);
    d.persistentId = "test-durable-duck";
    const s = await ScenarioSession.create({
      version: 1,
      id: "duck-contact",
      generation: FLAT_SCENARIO,
      player: fallingPlayer(),
      props: [],
      actors: [d],
    });
    try {
      const duck = () =>
        required(s.realm.entityManager.entities.find((e) => e.type === MALLARD_TYPE));
      for (let i = 0; i < 8; i++) {
        if (input) await s.step(idle);
        else s.tick();
      }
      expect(s.player.player.jumpVZ).toBeUndefined();
      expect(duck().mallard?.state).toBe("startle");
      const id = duck().persistentId;
      for (let i = 0; i < 60; i++) await s.step(idle);
      expect(duck().mallard?.state).toBe("flight");
      expect(duck().wz).toBeGreaterThan(0);
      const saved = encodeActor(duck());
      await s.reload();
      expect(duck().persistentId).toBe(id);
      expect(duck().mallard).toEqual(saved.state.mallard);
      for (let i = 0; i < 210; i++) await s.step(idle);
      expect(duck().mallard?.state).not.toBe("flight");
      expect(Math.abs(duck().wz ?? 0)).toBeLessThan(0.05);
      expect(duck().persistentId).toBe(id);
      expect(duck().deathTimer).toBeUndefined();
    } finally {
      await s.close();
    }
  },
);

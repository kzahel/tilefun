import { describe, expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { PlayerPredictor } from "../client/PlayerPredictor.js";
import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { FLAT_SCENARIO, scenarioWalls } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import { createFauna, faunaType } from "./Fauna.js";
import { startleFauna } from "./faunaInteractions.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
const horse = (s: ScenarioSession) =>
  required(s.realm.entityManager.entities.find((e) => e.type === faunaType("horse")));

async function scene(wall = false, freeze = true) {
  const animal = createFauna("horse", 64, 64);
  animal.persistentId = "horse-mount";
  if (freeze) {
    required(animal.fauna).state = "recover";
    required(animal.fauna).timer = 10;
  }
  return ScenarioSession.create({
    version: 1,
    id: "horse-riding",
    generation: FLAT_SCENARIO,
    player: createPlayer(36, 64),
    actors: [animal],
    props: wall ? scenarioWalls(-128, -128, 200, 200) : [],
  });
}

async function jumpOn(s: ScenarioSession) {
  // Ordinary input from beside the body: no teleport, launch assist or gravity override.
  for (let i = 0; i < 60 && s.player.gameplaySession.mountId === null; i++)
    await s.step({ ...idle, dx: 1, jump: true }, 1 / 60);
  expect(s.player.gameplaySession.mountId).toBe(horse(s).id);
  expect(s.player.player.parentId).toBe(horse(s).id);
  expect(s.player.player.wz).toBe((horse(s).wz ?? 0) + 18);
  expect(s.player.player.jumpVZ).toBeUndefined();
}

describe("horse riding through the shared Realm", () => {
  it("boards from the lab's body-height-aware falling arrival", async () => {
    const s = await scene();
    try {
      await s.command({ kind: "teleport", position: { ...horse(s).position }, z: 26 });
      for (let i = 0; i < 30; i++) await s.step(idle, 1 / 60);
      expect(s.player.gameplaySession.mountId).toBe(horse(s).id);
      expect(horse(s).wanderAI?.state).toBe("ridden");
      expect(s.player.player.jumpVZ).toBeUndefined();
    } finally {
      await s.close();
    }
  });
  it.each([true, false])(
    "boards with a default jump, including a startled horse (stationary=%s)",
    async (freeze) => {
      const s = await scene(false, freeze);
      try {
        // Existing saved individuals predate the rideSpeed setting.
        delete required(horse(s).wanderAI).rideSpeed;
        await jumpOn(s);
        expect(horse(s).wanderAI?.state).toBe("ridden");
        expect(horse(s).fauna?.motion).toBeUndefined();
        expect(horse(s).fauna?.alarmFrom).toBeUndefined();
        const x = horse(s).position.wx;
        for (let i = 0; i < 60; i++) await s.step({ ...idle, dx: 1 }, 1 / 60);
        expect(horse(s).position.wx - x).toBeCloseTo(160, 1);
        expect(s.player.player.position).toEqual(horse(s).position);
        expect(horse(s).sprite?.clip).toBe(4);
        expect(horse(s).sprite?.frameCol).toBeGreaterThanOrEqual(1);
        expect(startleFauna(horse(s), s.player.player.position)).toBe(false);
        const sprintX = horse(s).position.wx;
        for (let i = 0; i < 30; i++) await s.step({ ...idle, dx: 1, sprinting: true }, 1 / 60);
        expect(horse(s).position.wx - sprintX).toBeCloseTo(160, 1);
        expect(horse(s).sprite?.clip).toBe(5);
        await s.step(idle, 1 / 60);
        expect(horse(s).velocity).toEqual({ vx: 0, vy: 0 });
        expect(horse(s).sprite?.clip).toBe(0);
        await s.reload();
        expect(s.player.gameplaySession.mountId).toBe(horse(s).id);
        expect(s.player.player.parentId).toBe(horse(s).id);
        const dismount = { ...horse(s).position };
        await s.step({ ...idle, jump: true }, 1 / 60);
        expect(s.player.gameplaySession.mountId).toBeNull();
        expect(s.player.player.parentId).toBeUndefined();
        expect(s.player.player.jumpVZ).toBeGreaterThan(0);
        expect(horse(s).fauna?.home).toEqual(dismount);
        for (let i = 0; i < 45; i++) await s.step({ ...idle, dx: -1 }, 1 / 60);
        expect(s.player.gameplaySession.mountId).toBeNull();
        expect(horse(s).wanderAI?.state).not.toBe("ridden");
      } finally {
        await s.close();
      }
    },
  );

  it("never mounts from nearby ground and keeps whole-body obstacle collision", async () => {
    const s = await scene(true);
    try {
      for (let i = 0; i < 15; i++) await s.step({ ...idle, dx: 1 }, 1 / 60);
      expect(s.player.gameplaySession.mountId).toBeNull();
      await jumpOn(s);
      for (let i = 0; i < 90; i++) await s.step({ ...idle, dx: 1, sprinting: true }, 1 / 60);
      expect(horse(s).position.wx).toBeLessThanOrEqual(200 - 17);
      expect(horse(s).position.wx).toBeGreaterThan(150);
      expect(s.player.player.position).toEqual(horse(s).position);
    } finally {
      await s.close();
    }
  });

  it("predicts native speed, direction and animated riding clips from replicated definitions", async () => {
    const s = await scene();
    try {
      await jumpOn(s);
      await s.step(idle, 1 / 60);
      const predictor = new PlayerPredictor();
      predictor.reset(
        deserializeEntity(serializeEntity(s.player.player)),
        deserializeEntity(serializeEntity(horse(s))),
      );
      const move = { ...idle, dx: 0, dy: -1 };
      const originalY = horse(s).position.wy;
      for (let i = 0; i < 12; i++) {
        predictor.update(
          1 / 60,
          move,
          s.realm.world,
          [],
          [deserializeEntity(serializeEntity(horse(s)))],
        );
        await s.step(move, 1 / 60);
      }
      expect(predictor.mount?.position.wy).toBeCloseTo(horse(s).position.wy, 1);
      expect(originalY - horse(s).position.wy).toBeCloseTo(32, 1);
      expect(predictor.mount?.sprite?.direction).toBe(Direction.Up);
      expect(predictor.mount?.sprite?.clip).toBe(horse(s).sprite?.clip);
      expect(predictor.player?.wz).toBe(s.player.player.wz);
    } finally {
      await s.close();
    }
  });
});

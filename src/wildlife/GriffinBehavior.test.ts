import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { createPlayer } from "../entities/Player.js";
import { createProp } from "../entities/PropFactories.js";
import { FLAT_SCENARIO } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { createDeer } from "./Deer.js";
import { createPredator } from "./Predator.js";
import { clearPredatorFlight, startlePredator } from "./predatorAI.js";

const idle = { dx: 0, dy: 0, sprinting: false, jump: false };
const open = { canOccupy: () => true, isWater: () => false, surfaceZ: () => 0 };
it("rejects water, blocked aerial approaches and paths beyond the bounded corridor", () => {
  const griffin = createPredator("griffin", 0, 0);
  griffin.wz = 24;
  expect(clearPredatorFlight(griffin, { wx: 100, wy: 0 }, 0, open)).toBe(true);
  expect(
    clearPredatorFlight(griffin, { wx: 100, wy: 0 }, 0, {
      ...open,
      isWater: (p) => p.wx > 40 && p.wx < 60,
    }),
  ).toBe(false);
  expect(
    clearPredatorFlight(griffin, { wx: 100, wy: 0 }, 0, {
      ...open,
      canOccupy: (body, p) => p.wx < 40 || (body.wz ?? 0) > 100,
    }),
  ).toBe(false);
  expect(clearPredatorFlight(griffin, { wx: 300, wy: 0 }, 0, open)).toBe(false);
});
it.each([false, true])(
  "flies with bounded collision-owned travel, reloads its arc and lands (interrupted=%s)",
  async (interrupted) => {
    const hunter = createPredator("griffin", 64, 64),
      deer = createDeer(128, 64);
    required(hunter.predator).timer = 0;
    required(deer.deer).timer = 20;
    deer.naturalSpawnId = "world-deer";
    const session = await ScenarioSession.create({
      version: 1,
      id: `griffin-${interrupted}`,
      generation: FLAT_SCENARIO,
      player: createPlayer(64, 192),
      props: [],
      actors: [hunter, deer],
      traffic: [],
    });
    try {
      const bird = () =>
        required(session.realm.entityManager.entities.find((e) => e.type === hunter.type));
      for (let i = 0; i < 240 && !bird().predator?.flight; i++) await session.step(idle);
      expect(bird().predator?.flight?.attack).toBe(true);
      await session.step(idle);
      expect(bird().sprite?.clip).toBe(6);
      expect(bird().wz).toBeGreaterThan(0);
      expect(bird().predator?.meals).toBe(0);
      const arc = JSON.parse(JSON.stringify(bird().predator?.flight)),
        position = { ...bird().position };
      await session.reload();
      expect(bird().predator?.flight).toEqual(arc);
      expect(bird().position).toEqual(position);
      if (interrupted) startlePredator(bird(), { wx: 0, wy: 0 });
      for (let i = 0; i < 120 && bird().predator?.flight; i++) {
        const before = { ...bird().position };
        await session.step(idle);
        expect(
          Math.hypot(bird().position.wx - before.wx, bird().position.wy - before.wy),
        ).toBeLessThanOrEqual(80 / 30 + 0.01);
        expect(bird().predator?.meals).toBe(0);
      }
      expect(bird().predator?.flight).toBeUndefined();
      expect(bird().wz).toBe(0);
      if (interrupted) expect(bird().predator?.targetId).toBeUndefined();
      else {
        for (let i = 0; i < 300 && !bird().predator?.meals; i++) await session.step(idle);
        expect(bird().predator?.meals).toBe(1);
      }
      required(bird().predator).cooldown = 60;
      for (let i = 0; i < 600; i++) await session.step(idle);
      expect(bird().predator?.state).toBe("perch");
      expect(bird().wz).toBe(24);
      const rocks = session.realm.propManager.props.filter((p) => p.type === "prop-griffin-perch");
      expect(rocks).toHaveLength(1);
      session.realm.propManager.remove(required(rocks[0]).id);
      await session.reload();
      for (let i = 0; i < 60; i++) await session.step(idle);
      expect(session.realm.propManager.props.some((p) => p.type === "prop-griffin-perch")).toBe(
        false,
      );
    } finally {
      await session.close();
    }
  },
);

it("lands on an ordinary perch inserted beneath an already committed descending arc", async () => {
  const bird = createPredator("griffin", 88, 64);
  bird.wz = 52;
  Object.assign(required(bird.predator), {
    state: "flight",
    denPlaced: true,
    flight: {
      elapsed: 0.5,
      duration: 1,
      from: { wx: 64, wy: 64 },
      to: { wx: 112, wy: 64 },
      startZ: 48,
      endZ: 0,
      lift: 28,
      attack: false,
    },
  });
  const session = await ScenarioSession.create({
    version: 1,
    id: "edited-griffin-landing",
    generation: FLAT_SCENARIO,
    player: createPlayer(64, 192),
    props: [],
    actors: [bird],
    traffic: [],
  });
  try {
    await session.step(idle);
    const animal = () => required(session.realm.entityManager.entities.find((e) => e.predator));
    expect(animal().wz).toBeGreaterThan(24);
    session.realm.propManager.add(createProp("prop-griffin-perch", 112, 64));
    for (let i = 0; i < 60 && animal().predator?.flight; i++) await session.step(idle);
    expect(animal().predator?.flight).toBeUndefined();
    expect(animal().predator?.state).toBe("perch");
    expect(animal().wz).toBe(24);
    expect(animal().jumpZ).toBeUndefined();
    expect(animal().position.wx).toBeLessThanOrEqual(112);
    await session.reload();
    expect(animal().wz).toBe(24);
  } finally {
    await session.close();
  }
});

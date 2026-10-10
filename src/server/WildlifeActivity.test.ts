import { expect, it } from "vitest";
import { createBall } from "../entities/Ball.js";
import { createPlayer } from "../entities/Player.js";
import { FLAT_SCENARIO } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { createRobin } from "../wildlife/Robin.js";
import { WildlifeActivity } from "./WildlifeActivity.js";

const view = (cx = 0) => ({ minCx: cx, maxCx: cx, minCy: 0, maxCy: 0 });
const observer = { player: createPlayer(0, 0), visibleRange: view() };

it("unions local views/proximity and bounds extreme zoom or detached cameras", () => {
  const gate = new WildlifeActivity();
  expect(gate.awake([createRobin(180, 0)], [{ ...observer, visibleRange: view(50) }], [])).toBe(
    true,
  );
  expect(gate.awake([createRobin(650, 0)], [observer], [])).toBe(false);
  expect(gate.awake([createRobin(650, 0)], [{ ...observer, visibleRange: view(2) }], [])).toBe(
    true,
  );
  expect(
    gate.awake(
      [createRobin(1100, 0)],
      [{ ...observer, visibleRange: { ...view(), minCx: -20, maxCx: 20 } }],
      [],
    ),
  ).toBe(false);
  expect(
    gate.awake(
      [createRobin(2200, 0)],
      [observer, { player: createPlayer(2048, 0), visibleRange: view(8) }],
      [],
    ),
  ).toBe(true);
});

it("uses bounded hysteresis without retaining remote activity indefinitely", () => {
  const gate = new WildlifeActivity(),
    bird = createRobin(650, 0);
  expect(gate.awake([bird], [{ ...observer, visibleRange: view(2) }], [])).toBe(true);
  gate.advance(0.25);
  expect(gate.awake([bird], [observer], [])).toBe(true);
  gate.advance(0.26);
  expect(gate.awake([bird], [observer], [])).toBe(false);
});

it("retains attachments, followers, ordinary bodies and moving contact dependencies", () => {
  const gate = new WildlifeActivity(),
    bird = createRobin(650, 0),
    ball = createBall(655, 0);
  expect(gate.awake([bird], [observer], [ball])).toBe(true);
  bird.parentId = 10;
  expect(gate.awake([bird], [observer], [])).toBe(true);
  delete bird.parentId;
  if (bird.wanderAI) bird.wanderAI.following = true;
  expect(gate.awake([bird], [observer], [])).toBe(true);
  expect(gate.awake([ball], [observer], [])).toBe(true);
});

it("freezes resident motion/RNG/phase, reloads it and wakes without elapsed-time catch-up", async () => {
  const bird = createRobin(650, 32);
  if (!bird.robin) throw Error("Expected robin");
  bird.robin.state = "flight";
  bird.robin.target = { wx: 700, wy: 32, z: 0 };
  bird.robin.motion = { elapsed: 0.5, duration: 1.6, startZ: 0, endZ: 0, escaping: false };
  bird.wz = 30;
  const s = await ScenarioSession.create({
    version: 1,
    id: "wildlife-sleep",
    generation: FLAT_SCENARIO,
    player: createPlayer(32, 32),
    actors: [bird],
    props: [],
  });
  try {
    await s.ready({ minCx: -5, maxCx: 5, minCy: -5, maxCy: 5 });
    s.player.visibleRange = view();
    const find = () => s.realm.entityManager.entities.find((e) => e.robin?.home.wx === 650);
    const actor = find();
    if (!actor?.robin) throw Error("Missing bird");
    const before = {
      position: { ...actor.position },
      phase: actor.robin.motion?.elapsed,
      rng: actor.robin.randomState,
    };
    const cold = s.realm.entityManager.spawn(createRobin(680, 64));
    expect(cold.wz).toBeUndefined();
    s.tick(1 / 60);
    expect(cold.wz).toBeDefined();
    const coldTimer = cold.robin?.timer;
    for (let i = 0; i < 60; i++) s.tick(1 / 60);
    expect(cold.robin?.timer).toBe(coldTimer);
    expect(actor.position).toEqual(before.position);
    expect(actor.robin.motion?.elapsed).toBe(before.phase);
    expect(actor.robin.randomState).toBe(before.rng);
    await s.reload();
    s.player.visibleRange = view();
    const restored = find();
    expect(restored?.robin?.motion?.elapsed).toBe(before.phase);
    s.player.visibleRange = view(2);
    s.tick(1 / 60);
    expect(restored?.robin?.motion?.elapsed).toBeCloseTo((before.phase ?? 0) + 1 / 60);
  } finally {
    await s.close();
  }
});

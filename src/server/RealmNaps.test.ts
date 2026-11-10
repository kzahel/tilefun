// Napping leaves waiting actors out of a tick's per-actor work. Nothing a client
// receives may depend on it, and every way an actor is disturbed must end the nap.
import { createHash } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import type { Entity } from "../entities/Entity.js";
import { isNapping, wake } from "../entities/naps.js";
import { teleportBody } from "../physics/PhysicalEdits.js";
import type { PhysicsScene } from "../physics/PhysicsScene.js";
import { crowdBenchRecipe } from "../scenarios/CrowdBenchRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { decodeServerMessage } from "../shared/binaryCodec.js";
import { applyEntityDelta } from "../shared/entityDelta.js";
import { required } from "../shared/required.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import { createRabbit } from "../wildlife/Rabbit.js";
import { freshWork } from "../wildlife/WorkKit.js";
import { AiPlanningScheduler } from "./AiPlanningScheduler.js";
import { LONGEST_NAP, partitionNaps } from "./RealmNaps.js";

const DT = 1 / 60;
const sessions: ScenarioSession[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const s of sessions.splice(0)) await s.close();
});
async function crowd(rabbits: number) {
  const s = await ScenarioSession.create(crowdBenchRecipe(rabbits, 2));
  sessions.push(s);
  return s;
}
const rabbitsOf = (s: ScenarioSession) => s.realm.entityManager.entities.filter((e) => e.rabbit);
const napping = (s: ScenarioSession) => s.realm.collisionDiagnostics?.heldBodies ?? 0;

it("sends clients the same bytes whether or not actors nap", async () => {
  // Realm reads wall time (arrival grace): both sessions get the same fixed-step clock.
  let clock = Date.UTC(2026, 0, 1);
  vi.spyOn(Date, "now").mockImplementation(() => clock);
  const [naps, never] = [await crowd(120), await crowd(120)];
  // No body in the second realm ever counts as resting, so nothing there naps.
  required(never.realm.physicsScene).restful = () => false;
  let napped = 0,
    hopped = false;
  for (let tick = 0; tick < 420; tick++) {
    clock += 1000 / 60;
    const a = naps.tick(true),
      b = never.tick(true);
    // Scene epochs differ between two sessions, so compare frame sizes and, below,
    // everything those frames are built from.
    expect(a.map((frame) => frame.byteLength)).toEqual(b.map((frame) => frame.byteLength));
    const sent = (s: ScenarioSession) =>
      createHash("sha256")
        .update(JSON.stringify(s.realm.entityManager.entities.map(serializeEntity)))
        .update(JSON.stringify(s.realm.physicsState?.bodies))
        .update(JSON.stringify(s.realm.physicsState?.contacts.map(([a, b]) => a * 1e6 + b).sort()))
        .digest("hex");
    expect(`${tick}:${sent(naps)}`).toBe(`${tick}:${sent(never)}`);
    napped += napping(naps);
    hopped ||= rabbitsOf(naps).some((e) => e.rabbit?.state === "hop");
    expect(napping(never)).toBe(0);
  }
  expect(napped / 420).toBeGreaterThan(40);
  expect(hopped).toBe(true);
});

/** A lone resting rabbit with `seconds` of rest left, and one tick of the split. */
function resting(seconds: number) {
  const rabbit = createRabbit(0, 0);
  rabbit.id = 1;
  rabbit.motionIntent = { vx: 0, vy: 0 };
  rabbit.animalWork = { ...freshWork("rabbit"), cooldown: 30 };
  required(rabbit.rabbit).timer = seconds;
  const planning = new AiPlanningScheduler();
  const scene = { restful: () => true } as unknown as PhysicsScene;
  const players: Entity[] = [];
  const tier = { activity: 2 };
  let tick = 0;
  const split = () => {
    tick++;
    const { awake } = partitionNaps(
      new Map([[rabbit, DT]]),
      tick,
      players,
      scene,
      planning,
      () => tier.activity,
    );
    return awake.includes(rabbit);
  };
  return { rabbit, ai: required(rabbit.rabbit), players, tier, split, tick: () => tick };
}

it("wakes on the tick a rest runs out, with clocks exactly as if ticked throughout", () => {
  const { rabbit, ai, split } = resting(0.5);
  let timer = 0.5,
    elapsed = 0;
  const awakeAt: number[] = [];
  for (let tick = 1; tick <= 40; tick++) {
    if (split()) {
      awakeAt.push(tick);
      // What its own decision does while it waits.
      ai.timer -= DT;
      required(rabbit.animalWork).elapsed += DT;
    }
    timer -= DT;
    elapsed += DT;
    if (timer <= 0) {
      // The decision that ends the rest happens awake, on the same tick.
      expect(awakeAt.at(-1)).toBe(tick);
      expect(ai.timer).toBe(timer);
      expect(rabbit.animalWork?.elapsed).toBe(elapsed);
      break;
    }
  }
  expect(timer).toBeLessThanOrEqual(0);
  // First admitted tick, then its own regular waking tick: once in LONGEST_NAP + 1.
  const regular = (tick: number) => (tick + rabbit.id) % (LONGEST_NAP + 1) === LONGEST_NAP;
  expect(awakeAt.slice(1, 3)).toEqual([...Array(40).keys()].filter(regular).slice(0, 2));
  expect(awakeAt[0]).toBe(1);
});

it("ends a nap when a player comes near, the actor is startled, edited, leaves simulation or changes tier", () => {
  for (const disturb of [
    (r: ReturnType<typeof resting>) => r.players.push({ ...createRabbit(40, 0), id: 9 }),
    (r: ReturnType<typeof resting>) => wake(r.rabbit),
    (r: ReturnType<typeof resting>) => teleportBody(r.rabbit, { wx: 300, wy: 0, wz: 0 }),
    (r: ReturnType<typeof resting>) => {
      r.rabbit.simTick = r.tick() - 3;
    },
    // The player moved a chunk away: the actor now decides every fourth tick.
    (r: ReturnType<typeof resting>) => {
      r.tier.activity = 1;
    },
  ]) {
    const r = resting(10);
    expect(r.split()).toBe(true);
    expect(r.split()).toBe(false);
    expect(isNapping(r.rabbit, r.tick())).toBe(true);
    disturb(r);
    expect(r.split()).toBe(true);
    expect(r.rabbit.napFrom).toBeUndefined();
  }
});

it("does not run a startled rabbit's new timer down for the ticks it napped", () => {
  const r = resting(10);
  r.split();
  r.split();
  r.split();
  r.ai.state = "startle";
  r.ai.timer = 0.15;
  wake(r.rabbit);
  expect(r.split()).toBe(true);
  expect(r.ai.timer).toBe(0.15);
});

it("keeps actors awake that move, animate, ride or decide at the reduced rate", () => {
  const cases: ((r: ReturnType<typeof resting>) => void)[] = [
    (r) => {
      r.ai.state = "action";
    },
    (r) => {
      required(r.rabbit.motionIntent).vx = 4;
    },
    (r) => {
      r.rabbit.parentId = 7;
    },
    (r) => {
      required(r.rabbit.sprite).clip = 2;
    },
    (r) => {
      required(r.rabbit.animalWork).state = "seek";
    },
    // Farther from players an actor decides every fourth tick, on accumulated time.
    (r) => {
      r.tier.activity = 1;
    },
  ];
  for (const change of cases) {
    const r = resting(10);
    r.split();
    change(r);
    for (let i = 0; i < 4; i++) expect(r.split()).toBe(true);
  }
});

it("a napping animal a moving body runs into is woken, read and replicated at once", async () => {
  const s = await crowd(60);
  for (let i = 0; i < 240; i++) s.tick(true);
  const sleeper = required(
    rabbitsOf(s).find((e) => e.napFrom !== undefined && isNapping(e) && e.rabbit?.state === "rest"),
  );
  const before = { ...sleeper.position };
  // Another rabbit is set down beside it and driven into it.
  const pusher = required(rabbitsOf(s).find((e) => e !== sleeper));
  teleportBody(pusher, { wx: before.wx - 14, wy: before.wy, wz: 0 });
  pusher.motionIntent = { vx: 120, vy: 0 };
  let woke = false;
  for (let i = 0; i < 30 && !woke; i++) {
    pusher.motionIntent = { vx: 120, vy: 0 };
    if (pusher.rabbit) pusher.rabbit.state = "hop";
    s.tick(true);
    woke = sleeper.position.wx !== before.wx;
  }
  expect(woke).toBe(true);
  expect(isNapping(sleeper)).toBe(false);
});

it("sends a stream that fell behind what changed, even for actors napping by then", async () => {
  let clock = Date.UTC(2026, 0, 1);
  vi.spyOn(Date, "now").mockImplementation(() => clock);
  const s = await crowd(60);
  const mirror = new Map<number, Entity>();
  const receive = (frames: ArrayBuffer[]) => {
    for (const buffer of frames) {
      const message = decodeServerMessage(buffer);
      if (message.type !== "frame") continue;
      for (const baseline of message.entityBaselines ?? [])
        mirror.set(baseline.id, deserializeEntity(baseline));
      for (const delta of message.entityDeltas ?? [])
        applyEntityDelta(required(mirror.get(delta.id)), delta);
      for (const id of message.entityExits ?? []) mirror.delete(id);
    }
  };
  const step = (publish: boolean) => {
    clock += 1000 / 60;
    receive(s.tick(publish));
  };
  receive(s.frames());
  for (let i = 0; i < 240; i++) step(true);
  // The stream cannot send for a while (backpressure): rabbits hop, settle and nap.
  const before = rabbitsOf(s).map((e) => e.position.wx + e.position.wy);
  let ticks = 0;
  const moved = () => rabbitsOf(s).filter((e, i) => e.position.wx + e.position.wy !== before[i]);
  const settled = () => moved().filter((e) => isNapping(e) && e.napFrom !== undefined);
  while (ticks++ < 900 && settled().length < 3) step(false);
  expect(settled().length).toBeGreaterThanOrEqual(3);
  step(true);
  // The wire carries 32-bit floats.
  const wire = (e: Entity) =>
    JSON.stringify(serializeEntity(e), (_, v) => (typeof v === "number" ? Math.fround(v) : v));
  for (const e of s.realm.entityManager.entities)
    expect(wire(required(mirror.get(e.id)))).toBe(wire(e));
});

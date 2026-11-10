// Napping leaves waiting actors out of a tick's per-actor work. Nothing a client
// receives may depend on it, and every way an actor is disturbed must end the nap.
import { createHash } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import type { Entity } from "../entities/Entity.js";
import { isNapping, wake } from "../entities/naps.js";
import { tickSpriteAnimation } from "../entities/spriteAnimation.js";
import { teleportBody } from "../physics/PhysicalEdits.js";
import type { PhysicsScene } from "../physics/PhysicsScene.js";
import { crowdBenchRecipe } from "../scenarios/CrowdBenchRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { decodeServerMessage } from "../shared/binaryCodec.js";
import { applyEntityDelta } from "../shared/entityDelta.js";
import { required } from "../shared/required.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import { createRabbit } from "../wildlife/Rabbit.js";
import { prepareRabbitHop, restoreRabbitPose } from "../wildlife/rabbitInteractions.js";
import { freshWork } from "../wildlife/WorkKit.js";
import { AiPlanningScheduler } from "./AiPlanningScheduler.js";
import { endNaps, partitionNaps } from "./RealmNaps.js";

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

/** What a client holds: the frames applied, and its own animation clock run. */
function mirrorOf(s: ScenarioSession) {
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
  receive(s.frames());
  return { mirror, receive };
}

it("simulates the same world whether or not actors nap, and shows clients the same hops", async () => {
  // Realm reads wall time (arrival grace): both sessions get the same fixed-step clock.
  let clock = Date.UTC(2026, 0, 1);
  vi.spyOn(Date, "now").mockImplementation(() => clock);
  const [naps, never] = [await crowd(120), await crowd(120)];
  // No body in the second realm ever counts as resting, so nothing there naps.
  required(never.realm.physicsScene).restful = () => false;
  const clients = [mirrorOf(naps), mirrorOf(never)] as const;
  let napped = 0,
    hopNaps = 0,
    bytes = 0,
    neverBytes = 0;
  for (let tick = 0; tick < 420; tick++) {
    clock += 1000 / 60;
    const frames = [naps.tick(true), never.tick(true)] as const;
    bytes += frames[0].reduce((sum, frame) => sum + frame.byteLength, 0);
    neverBytes += frames[1].reduce((sum, frame) => sum + frame.byteLength, 0);
    // A rabbit napping through its gather or landing has its hop clock, and the
    // picture timed by it, brought up to date when the nap ends; all else is current.
    const lagging = new Set(
      rabbitsOf(naps)
        .filter((e) => e.napFrom !== undefined && e.rabbit?.state === "hop")
        .map((e) => e.id),
    );
    hopNaps += lagging.size;
    const sent = (s: ScenarioSession) =>
      createHash("sha256")
        .update(
          JSON.stringify(
            s.realm.entityManager.entities.map((e) => {
              const snapshot = serializeEntity(e);
              if (lagging.has(e.id)) delete snapshot.spriteState?.clipElapsedMs;
              return snapshot;
            }),
          ),
        )
        // Scene epochs differ between two sessions: compare what the state holds.
        .update(JSON.stringify(s.realm.physicsState?.bodies))
        .update(JSON.stringify(s.realm.physicsState?.contacts.map(([a, b]) => a * 1e6 + b).sort()))
        .digest("hex");
    expect(`${tick}:${sent(naps)}`).toBe(`${tick}:${sent(never)}`);
    // Each client runs timed clips itself between frames (ClientStateView).
    clients.forEach(({ mirror, receive }, i) => {
      receive(frames[i] as ArrayBuffer[]);
      for (const entity of mirror.values()) tickSpriteAnimation(entity, DT);
    });
    for (const [id, seen] of clients[0].mirror) {
      const other = required(clients[1].mirror.get(id));
      expect(seen.sprite?.clip).toBe(other.sprite?.clip);
      const [phase, truth] = [seen.sprite?.clipElapsedMs, other.sprite?.clipElapsedMs];
      // Rounded to a millisecond on the wire; the picture is never a frame apart.
      if (truth !== undefined) expect(Math.abs((phase ?? -99) - truth)).toBeLessThan(2);
      expect(seen.position).toEqual(other.position);
    }
    napped += napping(naps);
    expect(napping(never)).toBe(0);
  }
  expect(napped / 420).toBeGreaterThan(40);
  expect(hopNaps).toBeGreaterThan(100);
  expect(bytes).toBeLessThan(neverBytes);
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

it("naps back to back until its rest has run out and the planner would hear it, clocks exact", () => {
  const { rabbit, ai, split } = resting(0.5);
  let timer = 0.5,
    elapsed = 0;
  const awakeAt: number[] = [];
  for (let tick = 1; tick <= 60; tick++) {
    const awake = split();
    timer -= DT;
    elapsed += DT;
    if (!awake) continue;
    awakeAt.push(tick);
    // What its own decision does while it waits; skipped ones were replayed the same.
    ai.timer -= DT;
    required(rabbit.animalWork).elapsed += DT;
    expect(ai.timer).toBe(timer);
    expect(rabbit.animalWork?.elapsed).toBe(elapsed);
  }
  // Awake when first admitted, then not until the rest is over: no tick in between
  // would have done anything but run the clocks.
  expect(awakeAt[0]).toBe(1);
  expect(awakeAt.length).toBeGreaterThan(1);
  expect(awakeAt[1]).toBeGreaterThan(0.5 / DT);
  // Its planning clock (0.3 s here) comes due soon after: it is awake to ask.
  expect(awakeAt[1]).toBeLessThanOrEqual(0.5 / DT + 0.3 / DT + 1);
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
  const { mirror, receive } = mirrorOf(s);
  const step = (publish: boolean) => {
    clock += 1000 / 60;
    receive(s.tick(publish));
  };
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

/** A lone rabbit at the start of a hop to `target`, standing on flat ground. */
function hopper() {
  const r = resting(10);
  const rabbit = r.rabbit;
  r.ai.state = "hop";
  r.ai.target = { wx: 20, wy: 0 };
  r.ai.hop = { elapsed: 0, startZ: 0, endZ: 0, escaping: false };
  rabbit.groundZ = rabbit.wz = 0;
  restoreRabbitPose(rabbit);
  return r;
}

it("naps through a hop's gather and landing, awake for the travel and the settling tick", () => {
  const r = hopper(),
    twin = hopper();
  const awakeAt: number[] = [];
  for (let tick = 1; tick <= 60; tick++) {
    // The twin is prepared every tick; the napper only on the ticks it is simulated.
    prepareRabbitHop(twin.rabbit, DT);
    twin.rabbit.jumpZ = 0;
    if (r.split()) {
      awakeAt.push(tick);
      prepareRabbitHop(r.rabbit, DT);
      r.rabbit.jumpZ = 0;
      expect(r.ai.hop?.elapsed).toBe(twin.ai.hop?.elapsed);
      expect(r.rabbit.motionIntent).toEqual(twin.rabbit.motionIntent);
    }
  }
  expect(r.ai.hop?.elapsed).toBe(1);
  // Travel is the hop's 0.25–0.625 s: awake for all of it and for the last tick.
  const travel = [...Array(61).keys()].filter((tick) => tick > 15 && tick <= 38);
  expect(awakeAt).toEqual(expect.arrayContaining([...travel, 60]));
  expect(awakeAt.length).toBeLessThan(travel.length + 6);
});

it("asks the motor for nothing while a hopping rabbit stands, and holds its height once it has left the ground", () => {
  const { rabbit, ai } = hopper();
  prepareRabbitHop(rabbit, DT);
  expect(rabbit.motionIntent).toEqual({ vx: 0, vy: 0 });
  // Not standing (falling, or the ground gone): the prescribed height is kept.
  rabbit.jumpVZ = -3;
  prepareRabbitHop(rabbit, DT);
  expect(rabbit.motionIntent?.altitude).toBe(0);
  delete rabbit.jumpVZ;
  required(ai.hop).elapsed = 0.4;
  prepareRabbitHop(rabbit, DT);
  expect(rabbit.motionIntent?.altitude).toBeGreaterThan(5);
  expect(Math.hypot(rabbit.motionIntent?.vx ?? 0, rabbit.motionIntent?.vy ?? 0)).toBeGreaterThan(1);
  // Landed on the ground it aimed for: idle again. On lower ground: still held up.
  required(ai.hop).elapsed = 0.7;
  prepareRabbitHop(rabbit, DT);
  expect(rabbit.motionIntent?.altitude).toBeUndefined();
  rabbit.groundZ = -8;
  prepareRabbitHop(rabbit, DT);
  expect(rabbit.motionIntent?.altitude).toBeCloseTo(0, 9);
});

it("gives a late viewer a hop's current phase on the next tick, and a pause the phase it stopped at", async () => {
  let clock = Date.UTC(2026, 0, 1);
  vi.spyOn(Date, "now").mockImplementation(() => clock);
  const s = await crowd(120);
  const step = () => {
    clock += 1000 / 60;
    return s.tick(true);
  };
  const lagging = () =>
    rabbitsOf(s).filter(
      (e) => e.rabbit?.state === "hop" && isNapping(e) && e.simTick !== e.napFrom,
    );
  for (let i = 0; i < 900 && lagging().length < 2; i++) step();
  const [viewed, paused] = lagging();
  // Each picture still shows the phase its nap began with, some ticks ago.
  const phase = (e?: Entity) => e?.sprite?.clipElapsedMs ?? 0;
  const behind = (e?: Entity) => (e?.simTick ?? 0) + 1 - (e?.napFrom ?? 0);
  const [was, lag] = [phase(viewed), behind(viewed)];
  // A stream that has not seen the first rabbit yet takes its baseline: it is woken,
  // simulated on the next tick and sent with its phase current.
  type Streams = { streams: Map<string, { lastSentEntities: Map<number, unknown> }> };
  const { streams } = (s.realm as unknown as { replication: Streams }).replication;
  for (const stream of streams.values()) stream.lastSentEntities.delete(viewed?.id ?? 0);
  step();
  expect(viewed && isNapping(viewed)).toBe(false);
  step();
  expect(phase(viewed) - was).toBeGreaterThanOrEqual((lag + 1) * 16);
  // No session simulates (a pause): every napping clock is brought up to date.
  const [stopped, missed] = [phase(paused), behind(paused)];
  expect(paused?.rabbit?.state).toBe("hop");
  expect(missed).toBeGreaterThan(0);
  endNaps(s.realm);
  for (const e of rabbitsOf(s)) expect(e.napFrom).toBeUndefined();
  expect(phase(paused) - stopped).toBeGreaterThanOrEqual(missed * 16);
});

it("shows a napping hop's current phase when published outside a tick, and when its actor leaves simulation", async () => {
  let clock = Date.UTC(2026, 0, 1);
  vi.spyOn(Date, "now").mockImplementation(() => clock);
  const s = await crowd(120);
  const step = () => {
    clock += 1000 / 60;
    s.tick(true);
  };
  const lagging = () =>
    rabbitsOf(s).filter(
      (e) => e.rabbit?.state === "hop" && isNapping(e) && e.simTick !== e.napFrom,
    );
  const phase = (e?: Entity) => e?.sprite?.clipElapsedMs ?? 0;
  const behind = (e?: Entity) => (e?.simTick ?? 0) + 1 - (e?.napFrom ?? 0);
  for (let i = 0; i < 900 && lagging().length < 1; i++) step();
  // A workshop clock stop or manual step publishes without a tick (ScenarioSession).
  const [paused] = lagging();
  const [stopped, missed] = [phase(paused), behind(paused)];
  expect(missed).toBeGreaterThan(0);
  s.frames();
  expect(paused?.napFrom).toBeUndefined();
  expect(phase(paused) - stopped).toBeGreaterThanOrEqual(missed * 16);
  // An actor that drops out of the tick's split while a stream still shows it.
  for (let i = 0; i < 900 && lagging().length < 1; i++) step();
  const [left] = lagging();
  const [was, lag] = [phase(left), behind(left)];
  expect(lag).toBeGreaterThan(0);
  const realm = s.realm as unknown as { selectSimulationEntities: () => Map<Entity, number> };
  const select = realm.selectSimulationEntities.bind(s.realm);
  realm.selectSimulationEntities = (...args: []) => {
    const all = select(...args);
    all.delete(required(left));
    return all;
  };
  step();
  expect(left?.napFrom).toBeUndefined();
  expect(phase(left) - was).toBeGreaterThanOrEqual(lag * 16);
});

it("keeps rabbits hopping when every tick is published outside the tick (manual stepping)", async () => {
  const s = await crowd(60);
  let hopping = 0;
  for (let i = 0; i < 900; i++) {
    s.tick();
    s.frames();
    if (i % 30 === 0) hopping += rabbitsOf(s).filter((e) => e.rabbit?.state === "hop").length;
  }
  // Ending a nap replays the planner's clock too: no rabbit waits on it forever.
  expect(hopping).toBeGreaterThan(20);
  expect(Math.min(...rabbitsOf(s).map((e) => e.rabbit?.timer ?? 0))).toBeGreaterThan(-5);
});

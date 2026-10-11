import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { createChicken } from "../entities/Chicken.js";
import type { Entity } from "../entities/Entity.js";
import { createGhostAngry } from "../entities/Ghost.js";
import { createDeer } from "../wildlife/Deer.js";
import { createFauna, FAUNA_PROFILES } from "../wildlife/Fauna.js";
import { createFrog } from "../wildlife/Frog.js";
import { createMallard } from "../wildlife/Mallard.js";
import { createRabbit } from "../wildlife/Rabbit.js";
import { createRobin } from "../wildlife/Robin.js";
import { updateRabbitAI } from "../wildlife/rabbitAI.js";
import { updateRobinAI } from "../wildlife/robinAI.js";
import { AiPlanningScheduler } from "./AiPlanningScheduler.js";
import { tickAllAI } from "./tickAllAI.js";

const open = { isWater: () => false, canOccupy: () => true, surfaceZ: () => 0 };
const native = (e: Entity) =>
  required(e.fauna ?? e.deer ?? e.rabbit ?? e.frog ?? e.mallard ?? e.robin);

it("admits synchronized mixed goals across every wildlife profile deterministically within bounded work", () => {
  const run = () => {
    const animals = [
      ...FAUNA_PROFILES.map((p) => (x: number) => createFauna(p.species, x, 0)),
      (x: number) => createDeer(x, 0),
      (x: number) => createRabbit(x, 0),
      (x: number) => createFrog(x, 0),
      (x: number) => createMallard(x, 0),
      (x: number) => createRobin(x, 0),
    ].map((factory, i) => factory(i * 512));
    const planning = new AiPlanningScheduler();
    for (const e of animals) native(e).timer = 0;
    const dts = new Map(animals.map((e) => [e, 1 / 60]));
    const players = animals.map((e) => ({ wx: e.position.wx + 96, wy: 0 }));
    const admissions: number[] = [];
    let samples = 0;
    const blocked = {
      ...open,
      canOccupy: () => {
        samples++;
        return false;
      },
    };
    for (let tick = 0; tick < 60; tick++) {
      samples = 0;
      tickAllAI(animals, players, dts, () => 0.5, blocked, tick, planning);
      expect(samples).toBeLessThanOrEqual(768);
      expect(planning.budget.starts).toBeGreaterThanOrEqual(0);
      expect(planning.budget.candidates).toBeGreaterThanOrEqual(0);
      expect(planning.budget.samples).toBeGreaterThanOrEqual(0);
      admissions.push(animals.filter((e) => native(e).activity > 0).length);
    }
    expect(admissions.at(-1)).toBe(animals.length);
    return { admissions, states: animals.map(native) };
  };
  expect(run()).toEqual(run());
});

it("ages distant pending goals ahead of a sustained urgent stream", () => {
  const distant = createRabbit(4096, 0),
    urgent = createDeer(0, 0);
  const planning = new AiPlanningScheduler();
  let admittedAt = 0;
  for (let tick = 1; tick <= 60; tick++) {
    planning.begin();
    planning.advance(distant, 1 / 60, false);
    planning.advance(urgent, 1 / 60);
    const actors = [urgent, distant].sort(
      (a, b) => planning.priority(a, a === urgent) - planning.priority(b, b === urgent),
    );
    for (const e of actors) {
      if (!planning.claim(e, e === urgent)) continue;
      if (e === distant) {
        admittedAt = tick;
        break;
      }
      // A deliberately saturated urgent stream consumes the entire shared quota.
      planning.budget.starts = 0;
    }
    if (admittedAt) break;
  }
  expect(admittedAt).toBeGreaterThan(18);
  expect(admittedAt).toBeLessThanOrEqual(50);
});

it("keeps denied goal RNG/activity untouched and never accepts a partly checked route", () => {
  const rabbit = createRabbit(0, 0),
    planning = new AiPlanningScheduler();
  const ai = required(rabbit.rabbit),
    rng = ai.randomState;
  ai.timer = 0;
  planning.begin();
  planning.advance(rabbit, 0.1);
  planning.budget.starts = 0;
  updateRabbitAI(rabbit, 1 / 60, open, [rabbit], [], planning);
  expect(ai.randomState).toBe(rng);
  expect(ai.activity).toBe(0);
  planning.begin();
  planning.advance(rabbit, 1 / 60);
  planning.budget.samples = 1;
  let queries = 0;
  updateRabbitAI(
    rabbit,
    1 / 60,
    {
      ...open,
      canOccupy: () => {
        queries++;
        return true;
      },
    },
    [rabbit],
    [],
    planning,
  );
  expect(queries).toBe(0);
  expect(ai.hop).toBeUndefined();
  expect(ai.target).toEqual({ wx: 0, wy: 0 });
});

it("retains immediate alarms, exact timers and live following/chasing despite exhausted planning", () => {
  const animals = [
    createFauna("cow", 0, 0),
    createDeer(0, 512),
    createFrog(0, 1024),
    createRabbit(0, 1536),
    createRobin(0, 2048),
  ];
  const follower = createChicken(0, 2560),
    hostile = createGhostAngry(0, 3072);
  required(follower.wanderAI).following = true;
  const all = [...animals, follower, hostile];
  const players = all.map((e) => ({ wx: e.position.wx + 8, wy: e.position.wy }));
  const exhausted = new AiPlanningScheduler();
  exhausted.begin = () => {
    exhausted.budget.starts = 0;
  };
  tickAllAI(all, players, new Map(all.map((e) => [e, 1 / 60])), () => 0.5, open, 0, exhausted);
  for (const e of animals) {
    expect(native(e).state).toBe("startle");
    expect(native(e).alarmFrom).toEqual({ wx: 8, wy: e.position.wy });
  }
  expect(required(animals[0]?.fauna).timer).toBeCloseTo(0.4 - 1 / 60);
  expect(hostile.wanderAI?.state).toBe("chasing");
  expect(hostile.velocity?.vx).toBeGreaterThan(0);
  players[players.length - 2] = { wx: 60, wy: 2560 };
  tickAllAI(
    all,
    players,
    new Map([[follower, 1 / 60]]),
    () => 0.5,
    open,
    1,
    new AiPlanningScheduler(),
  );
  expect(follower.velocity?.vx).toBeGreaterThan(0);
});

it("runs generic ambient decisions through distance cadence while keeping route steering live", () => {
  const chicken = createChicken(0, 0),
    route = createChicken(512, 0);
  required(chicken.wanderAI).timer = 0;
  route.routeAI = {
    points: [{ wx: 544, wy: 0 }],
    index: 0,
    pause: 0,
    blocked: 0,
    last: { ...route.position },
  };
  const planning = new AiPlanningScheduler(),
    dts = new Map([
      [chicken, 1 / 60],
      [route, 1 / 60],
    ]);
  let draws = 0;
  tickAllAI(
    [chicken, route],
    [{ wx: 8192, wy: 0 }],
    dts,
    () => {
      draws++;
      return 0.5;
    },
    open,
    0,
    planning,
  );
  expect(chicken.wanderAI?.state).toBe("idle");
  expect(draws).toBe(0);
  expect(route.velocity?.vx).toBeGreaterThan(0);
  for (let tick = 1; tick < 18; tick++)
    tickAllAI(
      [chicken, route],
      [{ wx: 8192, wy: 0 }],
      dts,
      () => {
        draws++;
        return 0.5;
      },
      open,
      tick,
      planning,
    );
  expect(chicken.wanderAI?.state).toBe("walking");
  expect(draws).toBe(2);
});

it("accrues no decision time while absent and releases at most one decision on a large admitted dt", () => {
  const e = createRabbit(0, 0),
    planning = new AiPlanningScheduler();
  required(e.rabbit).randomState = 0;
  planning.begin();
  planning.advance(e, 1 / 60);
  for (let i = 0; i < 600; i++) tickAllAI([e], [], new Map(), () => 0, open, i, planning);
  expect(planning.claim(e, false)).toBe(false);
  planning.advance(e, 10);
  expect(planning.claim(e, false)).toBe(true);
  expect(planning.claim(e, false)).toBe(false);
});

it("reacts to a newly close player between distance classification slots", () => {
  const frog = createFrog(0, 0),
    planning = new AiPlanningScheduler();
  const dts = new Map([[frog, 1 / 60]]);
  tickAllAI([frog], [{ wx: 8192, wy: 0 }], dts, () => 0.5, open, 0, planning);
  expect(frog.frog?.state).toBe("rest");
  tickAllAI([frog], [{ wx: 8, wy: 0 }], dts, () => 0.5, open, 1, planning);
  expect(frog.frog?.state).toBe("startle");
  expect(frog.frog?.alarmFrom).toEqual({ wx: 8, wy: 0 });
  expect(frog.frog?.timer).toBeCloseTo(0.28 - 1 / 60);
});

it("propagates live fauna herd alarms without waiting for ambient classification", () => {
  const a = createFauna("cow", 0, 0),
    b = createFauna("cow", 64, 0);
  required(a.fauna).groupId = required(b.fauna).groupId = "herd";
  const planning = new AiPlanningScheduler(),
    dts = new Map([
      [a, 1 / 60],
      [b, 1 / 60],
    ]);
  tickAllAI([a, b], [{ wx: 8, wy: 0 }], dts, () => 0.5, open, 0, planning);
  expect(b.fauna?.alarmFrom).toEqual({ wx: 8, wy: 0 });
  expect(b.fauna?.state).toBe("startle");
  expect(b.fauna?.timer).toBeCloseTo(0.4 - 1 / 60);
});

it("defers ambient robin crown discovery until admission but keeps nearby crown alarms live", () => {
  const bird = createRobin(0, 0),
    planning = new AiPlanningScheduler();
  required(bird.robin).timer = 0;
  let queries = 0;
  const env = {
    ...open,
    perches: () => {
      queries++;
      return [];
    },
  };
  planning.begin();
  planning.advance(bird, 0.1);
  planning.budget.starts = 0;
  updateRobinAI(bird, 1 / 60, env, [bird], [], planning.budget, planning);
  expect(queries).toBe(0);
  updateRobinAI(bird, 1 / 60, env, [bird], [{ wx: 8, wy: 0 }], planning.budget, planning);
  expect(queries).toBe(1);
  expect(bird.robin?.state).toBe("startle");
});

it("refreshes an idle duck waterline even when the shared search quota is exhausted", () => {
  const duck = createMallard(0, 0),
    planning = new AiPlanningScheduler();
  required(duck.mallard).timer = 0;
  duck.noShadow = false;
  planning.begin = () => {
    planning.budget.starts = 0;
  };
  tickAllAI(
    [duck],
    [],
    new Map([[duck, 1 / 60]]),
    () => 0.5,
    { ...open, isWater: () => true },
    0,
    planning,
  );
  expect(duck.noShadow).toBe(true);
  expect(duck.mallard?.activity).toBe(0);
  expect(duck.sprite?.clip).toBe(0);
});

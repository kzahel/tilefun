import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { EntityManager } from "../entities/EntityManager.js";
import { PropManager } from "../entities/PropManager.js";
import { tickAllAI } from "../server/tickAllAI.js";
import { createDeer } from "./Deer.js";
import { DeerPlanningScheduler } from "./DeerPlanningScheduler.js";
import { updateDeerAI } from "./deerAI.js";

const open = { isWater: () => false, canOccupy: () => true, surfaceZ: () => 0 };

it("keeps cycling staggered ambient slots while actors rest without accumulating catch-up", () => {
  const deer = createDeer(0, 0),
    scheduler = new DeerPlanningScheduler();
  required(deer.deer).randomState = 0;
  const slots: number[] = [];
  for (let tick = 1; tick <= 18; tick++) {
    scheduler.begin();
    scheduler.advance(deer, 1 / 60);
    if (scheduler.claim(deer, false)) slots.push(tick);
  }
  expect(slots).toEqual([6, 12, 18]);
  scheduler.begin();
  scheduler.advance(deer, 10);
  expect(scheduler.claim(deer, false)).toBe(true);
  expect(scheduler.claim(deer, false)).toBe(false);
});

it("caps synchronized goal searches and eventually admits every deer deterministically", () => {
  const run = () => {
    const deer = Array.from({ length: 18 }, (_, i) => createDeer(i * 512, 0));
    for (const entity of deer) required(entity.deer).timer = 0;
    const scheduler = new DeerPlanningScheduler();
    const dts = new Map(deer.map((entity) => [entity, 1 / 60]));
    let samples = 0;
    const environment = {
      ...open,
      isWater: () => {
        samples++;
        return true;
      },
    };
    const admissions: number[] = [];
    for (let tick = 0; tick < 24; tick++) {
      samples = 0;
      tickAllAI(deer, [], dts, () => 0, environment, tick, scheduler);
      expect(samples).toBeLessThanOrEqual(24); // each blocked path stops at sample one
      admissions.push(deer.filter((entity) => required(entity.deer).activity === 1).length);
    }
    expect(admissions.at(-1)).toBe(18);
    return { admissions, states: deer.map((entity) => entity.deer) };
  };
  expect(run()).toEqual(run());
});

it("checks live player and herd alarms between ambient slots and advances timers exactly", () => {
  const a = createDeer(0, 0),
    b = createDeer(64, 0);
  required(a.deer).herdId = required(b.deer).herdId = "herd";
  const scheduler = new DeerPlanningScheduler();
  scheduler.begin();
  updateDeerAI(a, 1 / 60, open, [a, b], [{ wx: 0, wy: 10 }], scheduler);
  updateDeerAI(b, 1 / 60, open, [a, b], [], scheduler);
  expect(a.deer?.state).toBe("startle");
  expect(b.deer?.state).toBe("startle");
  expect(b.deer?.alarmFrom).toEqual({ wx: 0, wy: 10 });
  expect(b.deer?.timer).toBeCloseTo(0.4 - 1 / 60);
  expect(b.deer?.motion).toBeUndefined();
});

it("keeps native committed movement at 60Hz between decisions and accrues no sleeping motion", () => {
  const manager = new EntityManager(),
    props = new PropManager();
  const deer = manager.spawn(createDeer(64, 64));
  required(deer.deer).timer = 0;
  updateDeerAI(deer, 0.1, open, [deer], []);
  const scheduler = new DeerPlanningScheduler();
  const dts = new Map([[deer, 1 / 60]]);
  for (let tick = 0; tick < 30; tick++) {
    tickAllAI([deer], [], dts, () => 0, open, tick, scheduler);
    manager.update(
      1 / 60,
      () => 0,
      [],
      props,
      dts,
      () => 0,
    );
  }
  expect(Math.hypot(deer.position.wx - 64, deer.position.wy - 64)).toBeCloseTo(9, 3);
  const elapsed = required(required(deer.deer).motion).elapsed;
  for (let tick = 0; tick < 600; tick++)
    tickAllAI([deer], [], new Map(), () => 0, open, tick, scheduler);
  expect(deer.deer?.motion?.elapsed).toBe(elapsed);
  tickAllAI([deer], [], dts, () => 0, open, 600, scheduler);
  manager.update(
    1 / 60,
    () => 0,
    [],
    props,
    dts,
    () => 0,
  );
  expect(deer.deer?.motion?.elapsed).toBeCloseTo(elapsed + 1 / 60);
});

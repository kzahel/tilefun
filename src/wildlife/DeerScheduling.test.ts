import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { AiPlanningScheduler } from "../server/AiPlanningScheduler.js";
import { tickAllAI } from "../server/tickAllAI.js";
import { createDeer } from "./Deer.js";
import { updateDeerAI } from "./deerAI.js";

const open = { isWater: () => false, canOccupy: () => true, surfaceZ: () => 0 };

it("keeps cycling staggered ambient slots while actors rest without accumulating catch-up", () => {
  const deer = createDeer(0, 0),
    scheduler = new AiPlanningScheduler();
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
    const scheduler = new AiPlanningScheduler();
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
      expect(samples).toBeLessThanOrEqual(64); // each blocked path stops at sample one
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
  const scheduler = new AiPlanningScheduler();
  scheduler.begin();
  scheduler.advance(a, 1 / 60);
  scheduler.advance(b, 1 / 60);
  updateDeerAI(a, 1 / 60, open, [a, b], [{ wx: 0, wy: 10 }], scheduler);
  updateDeerAI(b, 1 / 60, open, [a, b], [], scheduler);
  expect(a.deer?.state).toBe("startle");
  expect(b.deer?.state).toBe("startle");
  expect(b.deer?.alarmFrom).toEqual({ wx: 0, wy: 10 });
  expect(b.deer?.timer).toBeCloseTo(0.4 - 1 / 60);
  expect(b.deer?.motion).toBeUndefined();
});

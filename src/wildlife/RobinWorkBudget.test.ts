import { expect, it } from "vitest";
import { tickAllAI } from "../server/tickAllAI.js";
import { createRobin } from "./Robin.js";
import { robinWorkBudget } from "./RobinWorkBudget.js";
import { updateRobinAI } from "./robinAI.js";

it("bounds route samples and commits only completely checked paths", () => {
  const bird = createRobin(0, 0);
  if (!bird.robin) throw Error("Expected robin");
  bird.robin.timer = 0;
  bird.robin.activity = 1;
  let samples = 0;
  const budget = robinWorkBudget();
  updateRobinAI(
    bird,
    1 / 60,
    {
      isWater: () => false,
      surfaceZ: () => 0,
      canOccupy: () => {
        samples++;
        return true;
      },
    },
    [bird],
    [{ wx: 100, wy: 0 }],
    budget,
  );
  expect(samples).toBeLessThanOrEqual(64);
  expect(samples).toBeGreaterThan(0);
  expect(bird.robin.motion).toBeDefined();
  expect(256 - budget.samples).toBe(samples);
  const blocked = createRobin(0, 0);
  if (!blocked.robin) throw Error("Expected robin");
  blocked.robin.timer = 0;
  blocked.robin.activity = 1;
  updateRobinAI(blocked, 1 / 60, { isWater: () => false, canOccupy: () => true }, [blocked], [], {
    starts: 1,
    candidates: 8,
    samples: 1,
  });
  expect(blocked.robin.motion).toBeUndefined();
});

it("defers admission without consuming activity/RNG and rotates a crowded queue fairly", () => {
  const birds = Array.from({ length: 12 }, (_, i) => createRobin(i * 30, 0));
  for (const bird of birds) {
    if (!bird.robin) throw Error("Expected robin");
    bird.robin.timer = 0;
    bird.robin.activity = 1;
  }
  const before = birds.map((b) => b.robin?.randomState);
  const env = { isWater: () => false, surfaceZ: () => 0, canOccupy: () => true };
  const first = birds[0];
  if (!first) throw Error("Expected bird");
  updateRobinAI(first, 1 / 60, env, birds, [], { starts: 0, candidates: 32, samples: 256 });
  expect(birds[0]?.robin?.activity).toBe(1);
  expect(birds[0]?.robin?.randomState).toBe(before[0]);
  for (let turn = 0; turn < 12; turn++) {
    let samples = 0;
    tickAllAI(
      birds,
      [],
      new Map(birds.map((b) => [b, 1 / 60])),
      () => 0.5,
      {
        ...env,
        canOccupy: () => {
          samples++;
          return true;
        },
      },
      turn,
    );
    expect(samples).toBeLessThanOrEqual(256);
  }
  expect(birds.every((b, i) => b.robin?.randomState !== before[i])).toBe(true);
});

it("does not let unreachable chunk-query crowns starve valid nearby perches", () => {
  const bird = createRobin(0, 0);
  if (!bird.robin) throw Error("Expected robin");
  bird.robin.timer = 0;
  bird.robin.activity = 1;
  const perch = { wx: 40, wy: 0, z: 32 };
  updateRobinAI(
    bird,
    1 / 60,
    {
      isWater: () => false,
      surfaceZ: () => 0,
      canOccupy: () => true,
      perches: () => [...Array.from({ length: 64 }, () => ({ wx: 200, wy: 0, z: 32 })), perch],
    },
    [bird],
    [{ wx: 100, wy: 0 }],
    robinWorkBudget(),
  );
  expect(bird.robin.target).toEqual(perch);
  expect(bird.robin.state).toBe("flight");
});

import { expect, it } from "vitest";
import { createPerson1 } from "../entities/Person.js";
import { createTrain } from "../railway/Train.js";
import { PredictionCollisionTimeline } from "./PredictionCollisionTimeline.js";

it("queries fractional simulation time, bounds future motion, and clears teleports/exits", () => {
  const timeline = new PredictionCollisionTimeline();
  const npc = createPerson1(10, 20);
  npc.id = 2;
  npc.velocity = { vx: 30, vy: 0 };
  const train = createTrain(60, 20);
  train.id = 3;
  timeline.record(1, [npc, train]);
  npc.position.wx = 11;
  timeline.record(1 + 1 / 30, [npc, train]);
  expect(timeline.poses(1 + 1 / 60, [npc, train], 1)[0]?.position.wx).toBeCloseTo(10.5);
  expect(timeline.poses(1 + 2 / 30, [npc, train], 1)[0]?.position.wx).toBeCloseTo(12);
  expect(timeline.poses(10, [npc, train], 1)[0]?.position.wx).toBeCloseTo(14);
  expect(npc.position.wx).toBe(11);
  expect(timeline.poses(10, [npc, train], 1)[1]).toBe(train);
  npc.position.wx = 100;
  timeline.record(1.1, [npc]);
  expect(timeline.poses(1, [npc], 1)[0]?.position.wx).toBe(100);
  timeline.record(0, [npc]);
  expect(timeline.poses(-1, [npc], 1)[0]?.position.wx).toBe(100);
  timeline.record(0.1, []);
  expect(timeline.poses(0.1, [npc], 1)[0]).toBe(npc);
  timeline.clear();
});

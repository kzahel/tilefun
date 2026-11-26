import { expect, it } from "vitest";
import { PedestrianGait } from "./PedestrianGait.js";

it("paces each pedestrian by displayed travel and fences stops, teleports and visibility gaps", () => {
  const gait = new PedestrianGait();
  function walk(time: number, x: number, moving = true) {
    gait.begin();
    gait.sample(2, { wx: 72 + x / 2, wy: 0 }, time, true, 28);
    return gait.sample(1, { wx: x, wy: 0 }, time, moving, 28);
  }
  expect(walk(0, 0)).toBe(0);
  expect(walk(0.2, 4)).toBeCloseTo(4 / 28);
  expect(walk(0.4, 4)).toBeCloseTo(4 / 28);
  expect(walk(0.6, 6)).toBeCloseTo(6 / 28);
  expect(walk(0.7, 6, false)).toBe(0);
  expect(walk(0.8, 76)).toBe(0);
  expect(walk(2, 81)).toBe(0);
  gait.begin();
  expect(walk(2.1, 83)).toBe(0);
});

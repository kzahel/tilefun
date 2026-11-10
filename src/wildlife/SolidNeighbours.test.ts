import { expect, it } from "vitest";
import { lcgNext } from "../shared/Determinism.js";
import { createFauna } from "./Fauna.js";
import { duringDecisions, solidWithin } from "./SolidNeighbours.js";

it("answers from the shared index exactly as a scan of the population does", () => {
  let seed = 7;
  const random = () => {
    seed = lcgNext(seed);
    return seed / 4294967296;
  };
  const animals = Array.from({ length: 300 }, (_, i) => {
    const e = createFauna("dog", (random() - 0.5) * 600, (random() - 0.5) * 600);
    e.id = i + 1;
    e.wz = random() * 20;
    if (i % 7 === 0 && e.collider) e.collider.solid = false;
    return e;
  });
  const self = animals[0];
  if (!self) throw Error("no animals");
  const level = (a: { wz?: number }) => (a.wz ?? 0) < 10;
  const ask = () => {
    const answers: boolean[] = [];
    let state = 99;
    const next = () => {
      state = lcgNext(state);
      return state / 4294967296;
    };
    for (let i = 0; i < 2000; i++) {
      const point = { wx: (next() - 0.5) * 700, wy: (next() - 0.5) * 700 };
      const radius = [12, 14, 24, 31.5, 70][i % 5] as number;
      answers.push(solidWithin(animals, self, point, radius, i % 2 ? level : undefined));
    }
    return answers;
  };
  const scanned = ask();
  const indexed = duringDecisions(animals, ask);
  expect(indexed).toEqual(scanned);
  expect(scanned.filter(Boolean).length).toBeGreaterThan(100);
  expect(scanned.filter((hit) => !hit).length).toBeGreaterThan(100);
  // A body exactly at the radius is outside it, as the planners' `<` always was.
  const at = { wx: self.position.wx, wy: self.position.wy };
  const other = animals.find((a) => a !== self && a.collider?.solid);
  if (!other) throw Error("no neighbour");
  other.position.wx = at.wx + 14;
  other.position.wy = at.wy;
  const alone = [self, other];
  expect(duringDecisions(alone, () => solidWithin(alone, self, at, 14))).toBe(false);
  expect(duringDecisions(alone, () => solidWithin(alone, self, at, 14.001))).toBe(true);
  // Another list during a pass is scanned, never answered from the pass's index.
  expect(duringDecisions(animals, () => solidWithin(alone, self, at, 14.001))).toBe(true);
});

import { expect, it } from "vitest";
import { ChunkResidency } from "./ChunkResidency.js";
import { around, InterestManager } from "./InterestManager.js";

it("unions distant tickets, takes strongest activity, and expires owned demand", () => {
  const interest = new InterestManager();
  interest.set("one", [{ range: around(0, 0, 1), activity: 2, reason: "player" }]);
  interest.set("two", [{ range: around(100, 100, 1), activity: 0, reason: "observer" }]);
  interest.set("interaction", [
    { range: around(100, 100, 0), activity: 2, reason: "dependency", expires: 5 },
  ]);
  expect(interest.demand(0).size).toBe(18);
  expect(interest.demand(0).get("100,100")?.activity).toBe(2);
  expect(interest.demand(5).get("100,100")?.activity).toBe(0);
  interest.release("one");
  expect(interest.demand(6).size).toBe(9);
});

it("discards cancelled reads, preserves renewed interest during saves, and retains failed writes", async () => {
  let finishLoad: ((data: string) => void) | undefined;
  let finishSave: (() => void) | undefined;
  let failSave = false;
  const published = new Set<string>();
  const interest = new InterestManager();
  const residency = new ChunkResidency(
    {
      load: (key) =>
        new Promise<string>((resolve) => {
          finishLoad = () => resolve(key);
        }),
      publish: (key) => {
        published.add(key);
      },
      save: () =>
        new Promise<void>((resolve, reject) => {
          finishSave = () => (failSave ? reject(new Error("disk full")) : resolve());
        }),
      canRelease: () => true,
      release: (key) => {
        published.delete(key);
      },
    },
    { holders: 1, loads: 1, saves: 1 },
  );
  const demand = () => interest.demand(0);
  interest.set("player", [{ range: around(0, 0, 0), activity: 2, reason: "player" }]);
  residency.reconcile(demand());
  interest.release("player");
  residency.reconcile(demand());
  await Promise.resolve();
  finishLoad?.("0,0");
  await residency.settle();
  expect(published.size).toBe(0);
  expect(residency.metrics.discarded).toBe(1);
  interest.set("player", [{ range: around(0, 0, 0), activity: 2, reason: "player" }]);
  residency.reconcile(demand());
  await Promise.resolve();
  finishLoad?.("0,0");
  await residency.settle();
  interest.release("player");
  residency.reconcile(demand());
  interest.set("player", [{ range: around(0, 0, 0), activity: 2, reason: "player" }]);
  residency.reconcile(demand());
  await Promise.resolve();
  finishSave?.();
  await residency.settle();
  expect(published.has("0,0")).toBe(true);
  interest.release("player");
  failSave = true;
  residency.reconcile(demand());
  await Promise.resolve();
  finishSave?.();
  await residency.settle();
  expect(published.has("0,0")).toBe(true);
  expect(residency.metrics.failures).toBe(1);
  expect(residency.metrics.highWater).toBe(1);
  await residency.close();
});

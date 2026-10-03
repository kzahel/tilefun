import { expect, it } from "vitest";
import { around, InterestManager } from "./InterestManager.js";

it("caps combined observer demand while reserving room for player and arrival readiness", () => {
  const interest = new InterestManager(12);
  interest.set("camera", [{ range: around(100, 100, 1), activity: 0, reason: "observer" }]);
  interest.set("player", [{ range: around(0, 0, 1), activity: 2, reason: "player" }]);
  interest.set("arrival", [{ range: around(20, 20, 0), activity: 0, reason: "arrival" }]);
  const demand = interest.demand(0);
  expect(demand.size).toBe(12);
  expect(demand.has("20,20")).toBe(true);
  for (let y = -1; y <= 1; y++)
    for (let x = -1; x <= 1; x++) expect(demand.get(`${x},${y}`)?.activity).toBe(2);
});

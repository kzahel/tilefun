import { describe, expect, it } from "vitest";
import { atDoorThreshold, DoorApproach, towardDoor } from "./DoorTraversal.js";

describe("deliberate door approaches", () => {
  it("requires entering the narrow threshold in the correct direction", () => {
    const door = { wx: 100, wy: 200 };
    expect(atDoorThreshold({ wx: 100, wy: 210 }, door, true)).toBe(true);
    expect(atDoorThreshold({ wx: 112, wy: 210 }, door, true)).toBe(false);
    expect(atDoorThreshold({ wx: 100, wy: 220 }, door, true)).toBe(false);
    expect(atDoorThreshold({ wx: 100, wy: 220 }, door, true, 16)).toBe(true);
    expect(atDoorThreshold({ wx: 112, wy: 220 }, door, true, 16)).toBe(false);
    expect(towardDoor(1, 0, true)).toBe(false);
    expect(towardDoor(0, 1, true)).toBe(false);
    expect(towardDoor(0, -1, true)).toBe(true);
    expect(towardDoor(0, 1, false)).toBe(true);
  });
  it("does not enter on spawn or reload, and re-arms only after leaving the doorway", () => {
    const approach = new DoorApproach();
    for (let i = 0; i < 10; i++) expect(approach.update(["a"], "a", true, 0.05)).toBe(false);
    approach.update([], null, false, 0.05);
    expect(approach.update(["a"], "a", true, 0.05)).toBe(false);
    expect(approach.update(["a"], "a", true, 0.05)).toBe(true);
    expect(approach.update(["a"], "a", true, 0.05)).toBe(false);
    approach.reset();
    expect(approach.update(["b"], "b", true, 0.1)).toBe(false);
  });
  it("resets intent when passing sideways, changing doors or releasing movement", () => {
    const approach = new DoorApproach();
    approach.update([], null, false, 0.05);
    approach.update(["a"], "a", true, 0.05);
    expect(approach.update(["a"], "a", false, 0.05)).toBe(false);
    expect(approach.update(["a"], "a", true, 0.05)).toBe(false);
    expect(approach.update(["a", "b"], "b", true, 0.05)).toBe(false);
    expect(approach.update(["a", "b"], "b", true, 0.05)).toBe(true);
  });
});

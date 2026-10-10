import { expect, it } from "vitest";
import { LocalServerWatchdog } from "./LocalServerWatchdog.js";

it("detects absent replies and frozen simulation separately", () => {
  const absent = new LocalServerWatchdog();
  absent.reset(0);
  for (let t = 5000; t < 30000; t += 5000) expect(absent.check(t)).toBeNull();
  expect(absent.check(30000)).toContain("stopped responding");
  const frozen = new LocalServerWatchdog();
  frozen.reset(0);
  frozen.reply(0, 20);
  for (let t = 5000; t <= 30000; t += 5000) {
    frozen.reply(t, 20);
    expect(frozen.check(t)).toBe(t === 30000 ? "Local server simulation stopped advancing" : null);
  }
});
it("allows slow progress and resets after suspension or a visibility fence", () => {
  const w = new LocalServerWatchdog();
  w.reset(0);
  for (let t = 5000; t < 120000; t += 5000) {
    w.reply(t, t);
    expect(w.check(t)).toBeNull();
  }
  expect(w.check(600000)).toBeNull();
  w.reset(900000);
  expect(w.check(905000)).toBeNull();
});

import { describe, expect, it } from "vitest";
import { DAY_SECONDS, forecast, START_SECONDS } from "../sky/Sky.js";
import { phoneScreen } from "./phoneScreen.js";

const HOUR = DAY_SECONDS / 24;

describe("the phone's screen", () => {
  it("shows a new world's first morning and what comes after", () => {
    const screen = phoneScreen({ seed: 42, time: START_SECONDS + 5.2, held: undefined });
    expect(screen).toMatchObject({
      time: "8:05 AM",
      day: "Day 1",
      sky: "day",
      now: { icon: "sun", label: "Sunny" },
    });
    expect(screen.later.map((row) => row.when)).toEqual(["9 AM", "Noon", "3 PM", "6 PM"]);
    // Clear until noon in every new world.
    expect(screen.later[0]).toMatchObject({ icon: "sun", label: "Sunny", tomorrow: false });
    expect(screen.later.some((row) => row.tomorrow)).toBe(false);
  });

  it("names the night, marks tomorrow once, and lists the forecast's weather", () => {
    const clock = { seed: 42, time: 2 * DAY_SECONDS + 22 * HOUR, held: undefined };
    const screen = phoneScreen({ ...clock, held: "clear" });
    expect(screen).toMatchObject({ time: "10:00 PM", day: "Day 3", sky: "night" });
    expect(screen.now).toEqual({ icon: "moon", label: "Clear night" });
    expect(screen.later.map((row) => row.when)).toEqual(["Midnight", "3 AM", "6 AM", "9 AM"]);
    expect(screen.later.map((row) => row.tomorrow)).toEqual([true, false, false, false]);
    const kinds = forecast(clock.seed, clock.time, 5).slice(1);
    const icons = { clear: ["sun", "moon"], cloudy: ["cloud"], rain: ["rain"], storm: ["storm"] };
    for (const [index, row] of screen.later.entries())
      expect(icons[kinds[index]?.kind ?? "clear"]).toContain(row.icon);
  });

  it("shows weather a command holds", () => {
    const screen = phoneScreen({ seed: 42, time: START_SECONDS, held: "storm" });
    expect(screen.now).toEqual({ icon: "storm", label: "Thunderstorm" });
  });
});

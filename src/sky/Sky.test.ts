import { describe, expect, it } from "vitest";
import {
  clockLabel,
  DAY_SECONDS,
  forecast,
  nextHour,
  periodWeather,
  START_SECONDS,
  skyAt,
  strikesBetween,
  WEATHER_HOURS,
} from "./Sky.js";

const HOUR = DAY_SECONDS / 24;
const SEEDS = [0, 1, 42, 2026, 987654321];

describe("the sky from a world's seed and clock", () => {
  it("starts a new world on a clear morning that stays clear until noon", () => {
    for (const seed of SEEDS) {
      for (let time = START_SECONDS; time < 11.5 * HOUR; time += 7) {
        const sky = skyAt(seed, time);
        expect(sky.day).toBe(1);
        expect(sky.kind).toBe("clear");
        expect(sky.tint).toEqual([1, 1, 1]);
        expect(sky.rain + sky.cloud + sky.flash).toBe(0);
      }
    }
    expect(skyAt(42, START_SECONDS).hour).toBe(8);
  });

  it("darkens to a blue night and counts days", () => {
    const midnight = skyAt(42, DAY_SECONDS, "clear");
    expect(midnight).toMatchObject({ day: 2, hour: 0, daylight: 0 });
    const [red, green, blue] = midnight.tint;
    expect(red).toBeLessThan(0.5);
    expect(blue).toBeGreaterThan(Math.max(red, green));
    // Dusk and dawn pass through every brightness in between.
    let previous = 1;
    for (let hour = 17.5; hour <= 20; hour += 0.05) {
      const { daylight } = skyAt(42, hour * HOUR, "clear");
      expect(daylight).toBeLessThanOrEqual(previous);
      expect(previous - daylight).toBeLessThan(0.05);
      previous = daylight;
    }
    expect(skyAt(42, 20.5 * HOUR, "clear").daylight).toBe(0);
  });

  it("forecasts the weather that then happens", () => {
    for (const seed of SEEDS) {
      const now = START_SECONDS + 5 * DAY_SECONDS + 100;
      const entries = forecast(seed, now, 12);
      expect(entries[0]?.kind).toBe(skyAt(seed, now).kind);
      for (const entry of entries) {
        // The middle of the period, away from where weather turns.
        const middle = ((entry.day - 1) * 24 + entry.hour + WEATHER_HOURS / 2) * HOUR;
        const sky = skyAt(seed, middle);
        expect(sky.kind).toBe(entry.kind);
        expect(sky.rain > 0).toBe(entry.kind === "rain" || entry.kind === "storm");
        expect(sky.cloud > 0).toBe(entry.kind !== "clear");
      }
    }
  });

  it("brings every kind of weather, and storms only out of cloud or rain", () => {
    for (const seed of SEEDS) {
      const seen = new Set<string>();
      for (let period = 0; period < 400; period++) {
        const kind = periodWeather(seed, period);
        seen.add(kind);
        if (kind === "storm") expect(periodWeather(seed, period - 1)).not.toBe("clear");
      }
      expect([...seen].sort()).toEqual(["clear", "cloudy", "rain", "storm"]);
    }
  });

  it("turns weather gradually between periods", () => {
    for (let time = 0; time < 6 * DAY_SECONDS; time += 0.5) {
      const step = Math.abs(skyAt(1, time + 0.5).rain - skyAt(1, time).rain);
      expect(step).toBeLessThan(0.05);
    }
  });

  it("strikes lightning in storms only, as soft flashes at the same moments for everyone", () => {
    const from = 30 * HOUR;
    expect(strikesBetween(42, from, from + 60, "rain")).toEqual([]);
    expect(skyAt(42, from + 3, "clear").flash).toBe(0);
    const strikes = [];
    for (let time = from; time < from + 180; time += 10)
      strikes.push(...strikesBetween(42, time, time + 10, "storm"));
    // A few a minute: thunder is an event, not a strobe.
    expect(strikes.length).toBeGreaterThan(8);
    expect(strikes.length).toBeLessThan(40);
    // Asked tick by tick, as a client does, the strikes are the same.
    const ticks = [];
    for (let tick = 0; tick < 180 * 60; tick++)
      ticks.push(...strikesBetween(42, from + tick / 60, from + (tick + 1) / 60, "storm"));
    expect(ticks).toEqual(strikes);
    for (const strike of strikes) {
      expect(skyAt(42, strike.time - 0.01, "storm").flash).toBeLessThan(0.3);
      const peak = skyAt(42, strike.time + 0.08, "storm").flash;
      expect(peak).toBeGreaterThan(0.25);
      expect(peak).toBeLessThanOrEqual(1);
      expect(skyAt(42, strike.time + 1.6, "storm").flash).toBeLessThan(0.05);
    }
    // A clock that jumps (a command, a new realm) is not a minute of thunder at once.
    expect(strikesBetween(42, from, from + 3600, "storm")).toEqual([]);
    expect(strikesBetween(42, from + 60, from, "storm")).toEqual([]);
  });

  it("holds weather a command asked for", () => {
    const sky = skyAt(42, START_SECONDS, "storm");
    expect(sky).toMatchObject({ kind: "storm", rain: 1, cloud: 1 });
    expect(sky.tint[0]).toBeLessThan(0.7);
  });

  it("moves the clock forward to an hour, never back", () => {
    expect(nextHour(START_SECONDS, 21)).toBe(21 * HOUR);
    expect(nextHour(START_SECONDS, 8)).toBe(DAY_SECONDS + 8 * HOUR);
    expect(nextHour(START_SECONDS, 0)).toBe(DAY_SECONDS);
    expect(nextHour(3 * DAY_SECONDS + 10 * HOUR, 6)).toBe(4 * DAY_SECONDS + 6 * HOUR);
  });

  it("labels the clock", () => {
    expect(clockLabel(0)).toBe("12:00 AM");
    expect(clockLabel(8.09)).toBe("8:05 AM");
    expect(clockLabel(12)).toBe("12:00 PM");
    expect(clockLabel(23.99)).toBe("11:59 PM");
  });
});

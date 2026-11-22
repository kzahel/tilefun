import { describe, expect, it } from "vitest";
import type { Entity } from "../entities/Entity.js";
import { DAY_SECONDS, START_SECONDS } from "../sky/Sky.js";
import { type AtmosphereView, playAtmosphere } from "./playAtmosphere.js";

const body = (type: string, wx: number, wy: number, wz = 0) =>
  ({ id: 1, type, position: { wx, wy }, wz }) as unknown as Entity;
const view = (overrides: Partial<AtmosphereView> = {}): AtmosphereView => ({
  entities: [body("player", 100, 200), body("chicken", 100, 200), body("player", 5000, 200)],
  eye: { x: 100, y: 200 },
  scale: 3,
  region: { width: 1280, height: 800 },
  indoors: false,
  headset: false,
  seconds: 12,
  ...overrides,
});
const noon = { seed: 42, time: START_SECONDS, held: undefined };
const midnight = { seed: 42, time: DAY_SECONDS, held: "storm" as const };

describe("the sky over a view of play", () => {
  it("leaves a clear day as it is drawn", () => {
    const atmosphere = playAtmosphere(noon, view());
    expect(atmosphere).toMatchObject({ tint: [1, 1, 1], rain: 0, flash: 0, glow: 0 });
    expect(atmosphere.lights).toBeUndefined();
  });

  it("gives each player in sight a lantern at night, top-down", () => {
    const atmosphere = playAtmosphere(midnight, view());
    expect(atmosphere.rain).toBe(1);
    expect(atmosphere.glow).toBeGreaterThan(0.5);
    expect(atmosphere.seconds).toBe(12);
    // The player at the eye, held above its feet; the far player is out of sight.
    expect(atmosphere.lights).toEqual([{ x: 640, y: 370, radius: 252 }]);
    // A body in the air carries its lantern up the screen.
    const raised = playAtmosphere(midnight, view({ entities: [body("player", 110, 200, 20)] }));
    expect(raised.lights).toEqual([{ x: 670, y: 310, radius: 252 }]);
    // Zoomed far out, a lantern still reaches a readable distance on screen.
    expect(playAtmosphere(midnight, view({ scale: 0.25 })).lights?.[0]?.radius).toBe(96);
  });

  it("lights the middle of a first-person view", () => {
    const { lights } = playAtmosphere(midnight, view({ scale: undefined }));
    expect(lights).toHaveLength(1);
    expect(lights?.[0]?.x).toBe(640);
  });

  it("keeps rooms dry and lit, and a headset's eyes free of screen rain", () => {
    const indoors = playAtmosphere(midnight, view({ indoors: true }));
    expect(indoors.rain).toBe(0);
    expect(indoors.lights).toBeUndefined();
    expect(Math.min(...indoors.tint)).toBeGreaterThan(0.7);
    const headset = playAtmosphere(midnight, view({ headset: true }));
    expect(headset.rain).toBe(0);
    expect(headset.lights).toBeUndefined();
    expect(headset.tint[0]).toBeLessThan(0.5);
  });
});

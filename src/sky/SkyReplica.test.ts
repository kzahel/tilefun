import { describe, expect, it } from "vitest";
import { SkyReplica } from "./SkyReplica.js";

describe("a replica's world clock", () => {
  it("has no sky until the server gives one, and none after leaving the realm", () => {
    const sky = new SkyReplica(() => 0);
    expect(sky.now).toBeUndefined();
    sky.apply({ type: "sync-sky", seed: 7, time: 500, tick: 0 });
    expect(sky.now).toEqual({ seed: 7, time: 500, held: undefined });
    sky.clear();
    expect(sky.now).toBeUndefined();
  });

  it("follows the realm's frame ticks from the tick it was given at", () => {
    let tick = 100;
    const sky = new SkyReplica(() => tick);
    sky.apply({ type: "sync-sky", seed: 7, time: 500, tick: 100, weather: "rain" });
    tick = 160;
    expect(sky.now).toEqual({ seed: 7, time: 501, held: "rain" });
  });

  it("keeps the given time while its tick is still the realm it came from", () => {
    // The clock arrives ahead of the new realm's first buffered frame.
    let tick = 90_000;
    const sky = new SkyReplica(() => tick);
    sky.apply({ type: "sync-sky", seed: 7, time: 500, tick: 12 });
    expect(sky.now?.time).toBe(500);
    tick = 72;
    expect(sky.now?.time).toBe(501);
  });
});

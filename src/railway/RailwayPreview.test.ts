import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  atDistance,
  BEND,
  CROSSOVER,
  motionPosition,
  pathLength,
  RAIL_CASES,
  RAIL_SOURCE,
  shuttle,
  sprite,
  trainLength,
  trainParts,
} from "./RailwayPreview.js";

describe("railway preview proposals", () => {
  it("pins the committed source and keeps all packed rectangles and visible bounds valid", () => {
    expect(
      createHash("sha256")
        .update(readFileSync(`public/${RAIL_SOURCE.image}`))
        .digest("hex"),
    ).toBe(RAIL_SOURCE.sha256);
    for (const s of Object.values(RAIL_SOURCE.sprites)) {
      const [x = 0, y = 0, w = 0, h = 0] = s.rect,
        [l = 0, t = 0, r = 0, b = 0] = s.bounds;
      expect(x + w).toBeLessThanOrEqual(RAIL_SOURCE.width);
      expect(y + h).toBeLessThanOrEqual(RAIL_SOURCE.height);
      expect(l).toBeGreaterThanOrEqual(0);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(w);
      expect(b).toBeLessThanOrEqual(h);
      expect(s.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });
  it("reviews five families in every travel direction with separate stable identities", () => {
    expect(new Set(RAIL_CASES.map((c) => c.id)).size).toBe(RAIL_CASES.length);
    for (const color of ["Blue", "Green", "Grey", "Orange", "White"] as const) {
      expect(
        RAIL_CASES.filter((c) => c.color === color)
          .map((c) => c.direction)
          .sort(),
      ).toEqual(["east", "north", "south", "west"]);
      for (const vertical of [true, false]) {
        const parts = trainParts(color, vertical);
        expect(parts).toHaveLength(color === "Orange" ? 2 : 3);
        for (const part of parts) expect(sprite(part.name)).toBeDefined();
        expect(trainLength(color, vertical)).toBeGreaterThan(100);
      }
    }
  });
  it("moves the native body in the selected direction without an instantaneous reversal", () => {
    for (const d of ["east", "west", "north", "south"] as const) {
      const delta = motionPosition(1, d, 1024, 300) - motionPosition(0, d, 1024, 300);
      expect(Math.sign(delta)).toBe(d === "west" || d === "north" ? -1 : 1);
    }
  });
  it("dwells at both ends and reverses continuously over repeated cycles", () => {
    expect(shuttle(0, 100, 900)).toBe(100);
    expect(shuttle(1, 100, 900)).toBe(100);
    expect(shuttle(10, 100, 900)).toBe(900);
    expect(shuttle(13, 100, 900)).toBe(900);
    expect(shuttle(24, 100, 900)).toBe(100);
    for (let t = 0; t < 48; t += 0.1) {
      expect(shuttle(t, 100, 900)).toBeGreaterThanOrEqual(100);
      expect(shuttle(t, 100, 900)).toBeLessThanOrEqual(900);
    }
  });
  it("keeps the head and following car sections on a continuous bounded path", () => {
    for (const path of [BEND, CROSSOVER]) {
      const length = pathLength(path);
      expect(atDistance(path, -10)).toMatchObject(path[0] ?? {});
      expect(atDistance(path, length + 100)).toMatchObject(path.at(-1) ?? {});
      for (let s = 0; s < length - 1; s += 10) {
        const a = atDistance(path, s),
          b = atDistance(path, s + 1);
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThanOrEqual(1.00001);
      }
    }
  });
});

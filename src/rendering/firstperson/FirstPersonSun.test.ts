import { describe, expect, it } from "vitest";
import { CHUNK_SIZE, TILE_SIZE } from "../../config/constants.js";
import type { GpuShadow } from "../GpuShadowShape.js";
import {
  chunkNearSun,
  SUN,
  SUN_FADE_END,
  SUN_RADIUS,
  SUN_REACH,
  SUN_SLOPE,
  SUN_SNAP,
  SUN_Z_MAX,
  SUN_Z_MIN,
  sunCardRight,
  sunCasterRange,
  sunClip,
  sunOrigin,
  writeBlob,
} from "./FirstPersonSun.js";

describe("first-person sun projection", () => {
  it("lands a raised point on the ground texel its shadow falls on", () => {
    const height = 120;
    const top = sunClip(40, -60, height);
    const shadow = sunClip(40 + SUN_SLOPE.x * height, -60 + SUN_SLOPE.y * height, 0);
    expect(top.x).toBeCloseTo(shadow.x, 9);
    expect(top.y).toBeCloseTo(shadow.y, 9);
    // The higher point is nearer the sun, so it wins the depth test.
    expect(top.z).toBeLessThan(shadow.z);
  });

  it("throws shadows north-west, away from a sun in the south-east", () => {
    expect(SUN.x).toBeGreaterThan(0);
    expect(SUN.y).toBeGreaterThan(0);
    expect(SUN_SLOPE.x).toBeLessThan(0);
    expect(SUN_SLOPE.y).toBeLessThan(0);
    expect(Math.hypot(SUN.x, SUN.y, SUN.z)).toBeCloseTo(1, 3);
  });

  it("covers the ground square around the origin and the mapped heights", () => {
    expect(sunClip(0, 0, 0)).toMatchObject({ x: 0, y: 0 });
    expect(sunClip(SUN_RADIUS, 0, 0).x).toBeCloseTo(1);
    // Game Y runs south; the map's Y runs north.
    expect(sunClip(0, SUN_RADIUS, 0).y).toBeCloseTo(-1);
    expect(sunClip(0, 0, SUN_Z_MAX).z).toBeCloseTo(-1);
    expect(sunClip(0, 0, SUN_Z_MIN).z).toBeCloseTo(1);
  });

  it("moves the map in whole steps so texels stay on world pixels", () => {
    expect(sunOrigin(10, -10)).toEqual({ x: 0, y: -0 });
    expect(sunOrigin(SUN_SNAP * 2.6, -SUN_SNAP * 3.4)).toEqual({
      x: SUN_SNAP * 3,
      y: -SUN_SNAP * 3,
    });
    // An eye never strays further than half a step, so the fade ends inside the map.
    expect(SUN_FADE_END + SUN_SNAP / 2).toBeLessThan(SUN_RADIUS);
  });

  it("turns standing cards across the sun's direction", () => {
    const right = sunCardRight();
    expect(Math.hypot(right.x, right.y)).toBeCloseTo(1);
    expect(right.x * SUN.x + right.y * SUN.y).toBeCloseTo(0);
  });

  it("redraws for chunk changes only where a shadow could show", () => {
    const size = CHUNK_SIZE * TILE_SIZE;
    const eye = { x: size / 2, y: size / 2 };
    // Content past the fog's end is hidden; past the fade it casts nothing visible.
    expect(sunCasterRange(400)).toBe(400);
    expect(sunCasterRange(5000)).toBe(SUN_FADE_END + SUN_REACH);
    const range = sunCasterRange(400);
    expect(chunkNearSun(0, 0, eye, range)).toBe(true);
    expect(chunkNearSun(2, 0, eye, range)).toBe(true); // nearest edge 1.5 chunks away
    expect(chunkNearSun(3, 0, eye, range)).toBe(false); // 2.5 chunks: beyond the fog
    expect(chunkNearSun(-3, -3, eye, range)).toBe(false);
  });
});

describe("first-person contact shadows", () => {
  const corners = (shadow: GpuShadow, support?: number) => {
    const out: number[] = [];
    writeBlob(out, 0, shadow, support);
    return [0, 1, 2, 3].map((i) => out.slice(i * 3, i * 3 + 3));
  };
  const oval: GpuShadow = {
    x: 100,
    y: 50,
    ux: 8,
    uy: 0,
    vx: 0,
    vy: 4,
    plane: [0, 0, 20],
    band: 8,
    support: 16,
    mask: "oval",
  };

  it("lays an oval flat on the surface under its caster", () => {
    const quad = corners(oval);
    expect(quad.map(([x, y]) => [x, y])).toEqual([
      [92, 46],
      [108, 46],
      [108, 54],
      [92, 54],
    ]);
    // An upright actor's oval is squashed for the fixed view; on the ground it is round.
    expect(corners({ ...oval, upright: true }).map(([x, y]) => [x, y])).toEqual([
      [92, 42],
      [108, 42],
      [108, 58],
      [92, 58],
    ]);
    for (const corner of quad) expect(corner[2]).toBeCloseTo(16.4);
    // A deck found under the caster replaces the collector's terrain height.
    for (const corner of corners(oval, 40)) expect(corner[2]).toBeCloseTo(40.4);
  });

  it("lays a grounded vehicle's footprint along its tilted underside", () => {
    // Climbing east at slope 0.5 through (100, 50, 30); the plane carries 4 px of slack.
    const ramp: GpuShadow = {
      ...oval,
      ux: 20,
      vy: 10,
      plane: [0.5, 0, 30 - 0.5 * 100 + 4],
      band: 8,
      support: 30,
      mask: "vehicle",
    };
    const quad = corners(ramp);
    expect(quad[0]?.[2]).toBeCloseTo(20.4); // west end, 20 px back down the ramp
    expect(quad[1]?.[2]).toBeCloseTo(40.4);
  });

  it("drops an airborne vehicle's shadow level onto the ground", () => {
    const jump: GpuShadow = {
      ...oval,
      ux: 20,
      vy: 10,
      plane: [0.5, 0, 90 - 0.5 * 100 + 4],
      band: 8 + 90,
      support: 0,
      mask: "vehicle",
    };
    for (const corner of corners(jump)) expect(corner[2]).toBeCloseTo(0.4);
  });
});

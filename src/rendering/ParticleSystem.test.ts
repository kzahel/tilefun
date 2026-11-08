import { afterEach, expect, it, vi } from "vitest";
import { TerrainId } from "../autotile/TerrainId.js";
import { createPlayer } from "../entities/Player.js";
import { yawRotation } from "../physics/BodyRotation.js";
import { RoadType } from "../road/RoadType.js";
import { surfaceProp } from "../scenarios/WorldGeometryRecipe.js";
import { createVehicle } from "../traffic/Vehicle.js";
import { Chunk } from "../world/Chunk.js";
import { ParticleSystem } from "./ParticleSystem.js";
import { SurfaceReceivers } from "./SurfaceReceivers.js";

const world = { getHeightAt: () => 0 };
const deck = surfaceProp(
  { left: -100, right: 100, top: -100, bottom: 100 },
  { id: "deck", spaceId: "upper", z: 48, riseX: 0, riseY: 0, thickness: 4, connectsTo: [] },
);
afterEach(() => vi.restoreAllMocks());
it("emits landing puffs at their actual contact height and lets them rise, then expire", () => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  const effects = new ParticleSystem(),
    player = createPlayer(0, 0);
  player.wz = 60;
  player.jumpVZ = -20;
  effects.observePlayer(player);
  const receivers = new SurfaceReceivers(world, [deck], [player]);
  effects.collectItems(receivers);
  player.wz = 48;
  delete player.jumpVZ;
  effects.observePlayer(player);
  const initial = effects.collectItems(receivers).filter((p) => p.kind === "particle");
  expect(initial).toHaveLength(10);
  expect(initial.every((p) => p.z > 48 && p.z < 48.1)).toBe(true);
  expect(effects.diagnostics.marks).toBe(1);
  effects.update(0.05);
  const lifted = effects.collectItems(receivers).filter((p) => p.kind === "particle");
  expect(lifted.every((p) => p.z > 49)).toBe(true);
  effects.update(1);
  expect(effects.collectItems(receivers)).toHaveLength(0);
  effects.observePlayer(player);
  expect(effects.diagnostics.pending).toBe(0);
});
it("orients a burst from a slope and keeps particles above its receiving plane", () => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  const ramp = surfaceProp(
    { left: 0, right: 64, top: -32, bottom: 32 },
    { id: "ramp", spaceId: "upper", z: 0, riseX: 32, riseY: 0, thickness: 4, connectsTo: [] },
  );
  const r = new SurfaceReceivers(world, [ramp], []),
    effects = new ParticleSystem();
  effects.spawnLandingDust(32, 0, 1, 16);
  effects.collectItems(r);
  effects.update(0.05);
  const p = effects.collectItems(r).filter((p) => p.kind === "particle");
  expect(p.every((p) => p.z > p.wx / 2)).toBe(true);
});
it("attaches only the contact mark to a moving roof; released dust inherits its motion", () => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  const car = createVehicle("compact-1", 0, 0);
  car.id = 10;
  car.wz = 0;
  car.velocity = { vx: 20, vy: 0 };
  const e = new ParticleSystem();
  e.spawnLandingDust(0, 0, 1, 24, 1);
  e.collectItems(new SurfaceReceivers(world, [], [car]));
  car.position.wx = 100;
  e.update(0.05);
  const items = e.collectItems(new SurfaceReceivers(world, [], [car]));
  const mark = items.find((p) => p.kind === "decal");
  expect(mark?.wx).toBeCloseTo(100);
  expect(items.filter((p) => p.kind === "particle").every((p) => p.wx < 10)).toBe(true);
  e.clear();
  expect(e.diagnostics).toEqual({ particles: 0, pending: 0, marks: 0 });
});
it("suppresses seated landings and reports respawn splashes once without treating them as dust", () => {
  const e = new ParticleSystem(),
    p = createPlayer(0, 0);
  p.wz = 10;
  p.jumpVZ = -10;
  e.observePlayer(p);
  p.position.wx = 100;
  p.wz = 0;
  delete p.jumpVZ;
  expect(e.observePlayer(p)).toEqual([0, 0, 10]);
  expect(e.observePlayer(p)).toBeUndefined();
  e.clear();
  p.jumpVZ = -10;
  e.observePlayer(p);
  p.parentId = 3;
  delete p.jumpVZ;
  e.observePlayer(p);
  expect(e.diagnostics.pending).toBe(0);
});

it("keeps airborne wisps and stomp clouds at their supplied world height", () => {
  vi.spyOn(Math, "random").mockReturnValue(0.1);
  const effects = new ParticleSystem();
  effects.spawnHostileWisp(0, 0, 30);
  effects.spawnStompCloud(0, 0, 40);
  const particles = effects
    .collectItems(new SurfaceReceivers(world, [], []))
    .filter((p) => p.kind === "particle");
  expect(particles.some((p) => p.z > 30 && p.z < 30.1)).toBe(true);
  expect(particles.some((p) => p.z > 40 && p.z < 40.1)).toBe(true);
  expect(effects.diagnostics.marks).toBe(0);
});

it("waits for support when prediction briefly clears an airborne flag above a roof", () => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  const car = createVehicle("compact-1", 0, 0);
  car.id = 10;
  car.wz = 0;
  const r = new SurfaceReceivers(world, [], [car]);
  const effects = new ParticleSystem(),
    p = createPlayer(0, 0);
  p.id = 1;
  p.wz = 40;
  p.jumpVZ = -30;
  effects.observePlayer(p);
  effects.collectItems(r);
  delete p.jumpVZ;
  p.wz = 39;
  effects.observePlayer(p);
  expect(effects.collectItems(r)).toHaveLength(0);
  p.wz = 24;
  effects.observePlayer(p);
  expect(effects.collectItems(r).some((p) => p.kind === "particle")).toBe(true);
  expect(effects.diagnostics.lastContact?.receiverId).toMatch(/^body:/);
  expect(effects.diagnostics.lastContact?.point[2]).toBe(24);
});

it("does not turn grounded-flag flicker on a roof into repeated landing bursts", () => {
  const car = createVehicle("compact-1", 0, 0);
  car.id = 10;
  const receivers = new SurfaceReceivers(world, [], [car]);
  const effects = new ParticleSystem(),
    player = createPlayer(0, 0);
  player.id = 1;
  for (let i = 0; i < 20; i++) {
    player.wz = 24.1;
    player.jumpVZ = -1;
    effects.observePlayer(player);
    effects.collectItems(receivers);
    player.wz = 24;
    delete player.jumpVZ;
    effects.observePlayer(player);
    expect(effects.collectItems(receivers)).toHaveLength(0);
  }
  expect(effects.diagnostics).toEqual({ particles: 0, pending: 0, marks: 0 });
});

it("throws surface spray from moving vehicles' rear wheels by material, within a budget", () => {
  const chunk = new Chunk();
  const ground = {
    getChunkIfLoaded: (cx: number, cy: number) => (cx === 0 && cy === 0 ? chunk : undefined),
  };
  const near = [{ minCx: 0, maxCx: 0, minCy: 0, maxCy: 0 }];
  const car = (vx: number, vy: number, wz = 0) => ({
    ...createVehicle("compact-1", 128, 128),
    id: 7,
    wz,
    velocity: { vx, vy },
    bodyRotation: yawRotation(0),
  });
  /** Particles thrown over one second of 60Hz frames. */
  const second = (material: TerrainId, entities: ReturnType<typeof car>[], views = near) => {
    chunk.subgrid.fill(material);
    const particles = new ParticleSystem();
    for (let i = 0; i < 60; i++) particles.observeVehicles(entities, ground, 1 / 60, views);
    return particles.count;
  };
  expect(second(TerrainId.Sand, [car(100, 0)])).toBeGreaterThan(10);
  expect(second(TerrainId.DirtWarm, [car(100, 0)])).toBeGreaterThan(10);
  expect(second(TerrainId.ShallowWater, [car(100, 0)])).toBeGreaterThan(10);
  // Grass shows only a slide; parked, airborne and paved wheels throw nothing.
  expect(second(TerrainId.Grass, [car(100, 0)])).toBe(0);
  expect(second(TerrainId.Grass, [car(100, 60)])).toBeGreaterThan(5);
  expect(second(TerrainId.Sand, [car(10, 0)])).toBe(0);
  expect(second(TerrainId.Sand, [car(100, 0, 20)])).toBe(0);
  // Off-screen cars (beyond a chunk of every view) spend none of the budget.
  expect(second(TerrainId.Sand, [car(100, 0)], [{ minCx: 5, maxCx: 6, minCy: 5, maxCy: 6 }])).toBe(
    0,
  );
  // A landing squat (rear body point a few px under the ground) still reads sand.
  expect(second(TerrainId.Sand, [car(100, 0, -3)])).toBeGreaterThan(10);
  // A crowd of fast cars stays inside the shared particle budget.
  const crowd = Array.from({ length: 200 }, (_, i) => ({ ...car(300, 0), id: 100 + i }));
  const crowded = second(TerrainId.Sand, crowd);
  expect(crowded).toBeGreaterThan(350);
  expect(crowded).toBeLessThanOrEqual(403);
  // Road tiles over the sand throw nothing.
  for (let tx = 0; tx < 16; tx++)
    for (let ty = 0; ty < 16; ty++) chunk.setRoad(tx, ty, RoadType.CityAsphalt);
  expect(second(TerrainId.Sand, [car(100, 0)])).toBe(0);
});

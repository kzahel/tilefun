import { expect, it } from "vitest";
import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { teleportBody } from "../physics/PhysicalEdits.js";
import { crowdedRoadTrafficRecipe, roadTrafficRecipe } from "../scenarios/RoadTrafficRecipe.js";
import { FLAT_SCENARIO, type ScenarioRecipe } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { required } from "../shared/required.js";
import { buildLaneGraph, nextLanes } from "./LaneGraph.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
const automatic = (s: ScenarioSession) =>
  [...required(s.realm.vehicleRegistry).states.values()].filter((s) => s.autonomous);

function straightRecipe(crossing = false): ScenarioRecipe {
  return {
    version: 1,
    id: "traffic-boundaries",
    generation: FLAT_SCENARIO,
    player: createPlayer(0, 128),
    props: [],
    trafficRoads: [
      { a: { x: -32, y: 0 }, b: { x: 32, y: 0 }, width: 8, intercity: false },
      ...(crossing
        ? [{ a: { x: 0, y: -32 }, b: { x: 0, y: 32 }, width: 8, intercity: false }]
        : []),
    ],
    roads: [
      { left: -576, top: -64, right: 576, bottom: 64 },
      ...(crossing ? [{ left: -64, top: -576, right: 64, bottom: 576 }] : []),
    ],
  };
}

it("queues behind a parked body without pushing it, then follows when the road clears", async () => {
  const s = await ScenarioSession.create(straightRecipe());
  try {
    const registry = required(s.realm.vehicleRegistry);
    for (const state of automatic(s)) s.realm.entityManager.remove(state.entity.id);
    registry.canSpawn = () => false;
    const follower = required(registry.place("compact-1", -240, 32, Direction.Right));
    const leader = required(registry.place("compact-1", -120, 32, Direction.Right));
    follower.autonomous = true;
    for (let i = 0; i < 240; i++) await s.step(idle);
    expect(leader.entity.position.wx).toBeCloseTo(-120, 1);
    expect(follower.entity.position.wx).toBeLessThan(-190);
    expect(Math.abs(follower.entity.velocity?.vx ?? Infinity)).toBeLessThan(1);
    const stopped = follower.entity.position.wx;
    teleportBody(leader.entity, { wx: 80, wy: 32, wz: 0 });
    for (let i = 0; i < 120; i++) await s.step(idle);
    expect(follower.entity.position.wx).toBeGreaterThan(stopped + 50);
  } finally {
    await s.close();
  }
});

it("spawns an ordinary road car beneath an unrelated elevated deck", async () => {
  const s = await ScenarioSession.create(straightRecipe());
  try {
    const registry = required(s.realm.vehicleRegistry);
    for (const state of automatic(s)) s.realm.entityManager.remove(state.entity.id);
    registry.canSpawn = () => true;
    s.realm.propManager.add({
      id: 900,
      type: "underpass-test-deck",
      isProp: true,
      position: { wx: 0, wy: 64 },
      sprite: { sheetKey: "", frameCol: 0, frameRow: 0, spriteWidth: 0, spriteHeight: 0 },
      walls: null,
      collider: {
        offsetX: 0,
        offsetY: 0,
        width: 1152,
        height: 128,
        surface: {
          id: "overhead",
          spaceId: "upper",
          z: 64,
          riseX: 0,
          riseY: 0,
          thickness: 2,
          connectsTo: [],
        },
      },
    });
    registry.populate([s.player.visibleRange]);
    expect(automatic(s).length).toBeGreaterThan(0);
    expect(automatic(s).every((s) => s.entity.wz === 0)).toBe(true);
  } finally {
    await s.close();
  }
});

it("clears four queued approaches and restores an occupied junction without stale ownership", async () => {
  const recipe = straightRecipe(true),
    s = await ScenarioSession.create(recipe);
  try {
    let registry = required(s.realm.vehicleRegistry);
    for (const state of automatic(s)) s.realm.entityManager.remove(state.entity.id);
    registry.canSpawn = () => false;
    const graph = buildLaneGraph(required(recipe.trafficRoads));
    const placements = [
      [-180, 32, Direction.Right],
      [180, -32, Direction.Left],
      [32, 180, Direction.Up],
      [-32, -180, Direction.Down],
    ] as const;
    const identities: string[] = [];
    for (const [x, y, facing] of placements) {
      const state = required(registry.place("compact-1", x, y, facing));
      state.autonomous = true;
      const lane = required(
        [...graph.lanes.values()].find((l) => l.direction === facing && l.to === "0,0"),
      );
      const next = required(nextLanes(graph, lane).find((l) => l.direction === facing));
      state.route = { laneId: lane.id, nextId: next.id, choices: 0 };
      identities.push(required(state.entity.proceduralId));
      registry.onChange?.(state, false);
    }
    let reloaded = false;
    for (let tick = 0; tick < 2400; tick++) {
      await s.step(idle);
      const states = [...registry.states.values()].filter((s) =>
        identities.includes(s.entity.proceduralId ?? ""),
      );
      if (
        !reloaded &&
        states.some(
          (s) => s.route?.turning && Math.hypot(s.entity.position.wx, s.entity.position.wy) < 48,
        )
      ) {
        await s.reload();
        registry = required(s.realm.vehicleRegistry);
        registry.canSpawn = () => false;
        reloaded = true;
      }
    }
    expect(reloaded).toBe(true);
    const states = [...registry.states.values()].filter((s) =>
      identities.includes(s.entity.proceduralId ?? ""),
    );
    expect(states).toHaveLength(4);
    expect(states.every((s) => (s.route?.choices ?? 0) >= 1)).toBe(true);
  } finally {
    await s.close();
  }
});

it("keeps ordinary traffic circulating through corners and crossings using one physics step", async () => {
  const s = await ScenarioSession.create(roadTrafficRecipe());
  try {
    const initial = automatic(s).map((s) => ({
      id: s.entity.id,
      x: s.entity.position.wx,
      y: s.entity.position.wy,
    }));
    expect(initial.length).toBeGreaterThan(1);
    let largestStep = 0,
      middleChoices = 0;
    for (let tick = 0; tick < 1800; tick++) {
      const before = new Map(automatic(s).map((s) => [s.entity.id, { ...s.entity.position }]));
      await s.step(idle);
      for (const { entity: e } of automatic(s)) {
        const p = before.get(e.id);
        if (p)
          largestStep = Math.max(
            largestStep,
            Math.hypot(e.position.wx - p.wx, e.position.wy - p.wy),
          );
        expect(Math.abs(e.position.wx)).toBeLessThan(480);
        expect(Math.abs(e.position.wy)).toBeLessThan(352);
      }
      if (tick === 900)
        middleChoices = automatic(s).reduce((n, s) => n + (s.route?.choices ?? 0), 0);
    }
    expect(largestStep).toBeLessThan(2);
    expect(
      automatic(s).some(
        (s) => Math.hypot(s.entity.velocity?.vx ?? 0, s.entity.velocity?.vy ?? 0) > 5,
      ),
    ).toBe(true);
    expect(automatic(s).reduce((n, s) => n + (s.route?.choices ?? 0), 0)).toBeGreaterThan(
      middleChoices + 3,
    );
    expect(s.realm.collisionDiagnostics?.worldSteps).toBe(1800);
    const registry = required(s.realm.vehicleRegistry),
      count = registry.states.size;
    registry.populate([s.player.visibleRange]);
    expect(registry.states.size).toBe(count);
    expect(count).toBeLessThanOrEqual(33);
  } finally {
    await s.close();
  }
});

it("persists traffic ownership/routes, keeps a placed car parked, and safely reacquires after takeover", async () => {
  const s = await ScenarioSession.create(roadTrafficRecipe());
  try {
    for (let i = 0; i < 240; i++) await s.step(idle);
    const registry = required(s.realm.vehicleRegistry),
      state = required(automatic(s)[0]);
    const identity = state.entity.proceduralId;
    const parked = required(registry.states.get(required(s.handles.car)));
    expect(parked.autonomous).toBe(false);
    const saved = registry.snapshot(state);
    await s.reload();
    const restored = required(
      [...required(s.realm.vehicleRegistry).states.values()].find(
        (s) => s.entity.proceduralId === identity,
      ),
    );
    expect(restored.autonomous).toBe(true);
    expect(restored.route).toEqual(saved.route);
    expect(restored.entity.position).toEqual({ wx: saved.wx, wy: saved.wy });
    expect(required(s.realm.vehicleRegistry).states.get(required(s.handles.car))?.autonomous).toBe(
      false,
    );
    const vehicles = required(s.realm.vehicleRegistry);
    vehicles.takeControl(restored, 999);
    expect(
      vehicles.traffic
        .plan([restored.entity], s.realm.physicsState?.tick ?? 0)
        .has(restored.entity.id),
    ).toBe(false);
    vehicles.releaseControl(restored);
    expect(
      vehicles.traffic
        .plan([restored.entity], s.realm.physicsState?.tick ?? 0)
        .has(restored.entity.id),
    ).toBe(true);
    // Leaving a road car in the grass parks it durably instead of inventing a route.
    vehicles.takeControl(restored, 999);
    restored.entity.position = { wx: 200, wy: 128 };
    vehicles.releaseControl(restored);
    vehicles.traffic.plan([restored.entity], s.realm.physicsState?.tick ?? 0);
    expect(restored.autonomous).toBe(false);
    expect(vehicles.snapshot(restored).autonomous).toBe(false);
  } finally {
    await s.close();
  }
});

it("reconnects a legacy road car inside a junction", async () => {
  const s = await ScenarioSession.create(straightRecipe(true));
  try {
    const r = required(s.realm.vehicleRegistry);
    for (const state of automatic(s)) s.realm.entityManager.remove(state.entity.id);
    r.canSpawn = () => false;
    r.restore([
      {
        identity: "traffic-v1:legacy-road-car",
        model: "compact-1",
        wx: 10,
        wy: 32,
        facing: Direction.Right,
        persistentId: "legacy-road-car",
        originScope: "0,0",
      },
    ]);
    const car = required(automatic(s)[0]);
    for (let i = 0; i < 90; i++) await s.step(idle);
    expect(car.autonomous).toBe(true);
    expect(car.entity.position.wx).toBeGreaterThan(30);
    expect(Math.abs(car.entity.position.wy - 32)).toBeLessThan(1);
  } finally {
    await s.close();
  }
});

it("keeps every car progressing through a sustained crowded grid after wide-turn joins", async () => {
  const s = await ScenarioSession.create(crowdedRoadTrafficRecipe());
  const range = { minCx: -5, maxCx: 5, minCy: -5, maxCy: 5 };
  try {
    await s.ready(range);
    const cars = automatic(s);
    expect(cars.length).toBeGreaterThanOrEqual(12);
    let tail = new Map<number, number>();
    for (let tick = 0; tick < 14400; tick++) {
      s.tick();
      if (tick === 10799)
        tail = new Map(automatic(s).map((c) => [c.entity.id, c.route?.choices ?? 0]));
    }
    expect(automatic(s)).toHaveLength(cars.length);
    for (const c of automatic(s))
      expect((c.route?.choices ?? 0) - (tail.get(c.entity.id) ?? 0)).toBeGreaterThan(0);
  } finally {
    await s.close();
  }
}, 30000);

it("takes a continuing road instead of feeding a dead-end spur when a through route exists", async () => {
  const recipe = crowdedRoadTrafficRecipe();
  recipe.trafficRoads?.push({ a: { x: -16, y: 0 }, b: { x: 0, y: 0 }, width: 8, intercity: false });
  recipe.roads?.push({ left: -320, right: 64, top: -64, bottom: 64 });
  const s = await ScenarioSession.create(recipe);
  try {
    await s.ready({ minCx: -5, maxCx: 5, minCy: -5, maxCy: 5 });
    for (let i = 0; i < 3000; i++) {
      s.tick();
      expect(
        automatic(s).some(
          (c) => c.route?.nextId?.endsWith(">0,0") || c.route?.laneId.endsWith(">0,0"),
        ),
      ).toBe(false);
    }
  } finally {
    await s.close();
  }
}, 60_000);

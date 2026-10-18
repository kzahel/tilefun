import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import type { ParkingSystem } from "../traffic/ParkingSystem.js";
import { parkingRecipe } from "./parkingTestFixture.js";
import { ScenarioSession } from "./ScenarioSession.js";

const range = { minCx: 0, maxCx: 4, minCy: 0, maxCy: 3 };
const input = { dx: 0, dy: 0, jump: false, sprinting: false };
const semantic = (parking: ParkingSystem) =>
  parking.states.map((s) => ({
    phase: s.phase,
    index: s.index,
    remaining: s.remaining,
    completed: s.completed,
    car: s.car && { position: s.car.position, velocity: s.car.velocity, sprite: s.car.sprite },
    shopper: s.shopper && {
      position: s.shopper.position,
      velocity: s.shopper.velocity,
      sprite: s.shopper.sprite,
    },
  }));

it("completes every trip, preserves each phase on reload, and never overlaps cars or crosses an active aisle", async () => {
  const session = await ScenarioSession.create(parkingRecipe());
  try {
    let parking = required(session.realm.parking);
    const phases = new Set<string>();
    let max = 0;
    for (let i = 0; i < 12000; i++) {
      await session.step(input, 1 / 60, range);
      parking = required(session.realm.parking);
      max = Math.max(max, parking.maneuvers);
      expect(parking.maneuvers).toBeLessThanOrEqual(2);
      const cars = parking.states.flatMap((s) => (s.car ? [s.car] : []));
      for (const [j, a] of cars.entries())
        for (const b of cars.slice(j + 1))
          expect(
            aabbsOverlap(
              getEntityAABB(a.position, required(a.collider)),
              getEntityAABB(b.position, required(b.collider)),
            ),
          ).toBe(false);
      const aisleOwners = parking.states.flatMap((s, j) =>
        ["arriving", "leaving", "walking-to-shop", "returning"].includes(s.phase)
          ? [required(parking.lot.visits[j]).aisle]
          : [],
      );
      expect(new Set(aisleOwners).size).toBe(aisleOwners.length);
      for (const state of parking.states)
        if (state.shopper) {
          const replica = deserializeEntity(serializeEntity(state.shopper));
          expect(replica.sprite?.sheetKey).toBe("person1");
          expect(replica.collider).toEqual(state.shopper.collider);
        }
      const phase = required(parking.states[0]).phase;
      if (!phases.has(phase)) {
        phases.add(phase);
        const before = structuredClone(semantic(parking));
        await session.reload();
        parking = required(session.realm.parking);
        expect(semantic(parking)).toEqual(before);
        expect(
          [...required(session.realm.traffic).states.values()].filter((s) => s.placed),
        ).toHaveLength(required(session.recipe.parkedVehicles).length);
        expect(
          session.realm.entityManager.entities.filter((e) => e.tags?.has("parking-visit")),
        ).toHaveLength(
          parking.states.reduce((n, s) => n + Number(!!s.car) + Number(!!s.shopper), 0),
        );
      }
      if (parking.states.every((s) => s.completed > 0)) break;
    }
    expect(parking.states.map((s) => s.completed)).toEqual(expect.arrayContaining([1]));
    expect(
      parking.states.every((s) => s.completed > 0),
      JSON.stringify(parking.diagnostics),
    ).toBe(true);
    expect(max).toBe(2);
    expect([...phases].sort()).toEqual(
      [
        "arriving",
        "parked",
        "walking-to-shop",
        "shopping",
        "returning",
        "ready-to-leave",
        "leaving",
        "waiting",
      ].sort(),
    );
  } finally {
    await session.close();
  }
}, 60000);

it("waits at an obstructed entrance and resumes without deleting or teleporting the obstacle", async () => {
  const recipe = parkingRecipe();
  recipe.player.position = { wx: 32, wy: 264 };
  const session = await ScenarioSession.create(recipe);
  try {
    for (let i = 0; i < 120; i++) await session.step(input, 1 / 60, range);
    const parking = required(session.realm.parking);
    expect(required(parking.states[0]).phase).toBe("waiting");
    expect(session.player.player.position).toEqual(recipe.player.position);
    await session.command({ kind: "teleport", position: { wx: 608, wy: 192 } });
    await session.step(input, 1 / 60, range);
    expect(required(parking.states[0]).phase).toBe("arriving");
    const car = required(required(parking.states[0]).car);
    await session.command({ kind: "teleport", position: { wx: 130, wy: 264 } });
    for (let i = 0; i < 180; i++) await session.step(input, 1 / 60, range);
    const stopped = { ...car.position };
    for (let i = 0; i < 30; i++) await session.step(input, 1 / 60, range);
    expect(car.position).toEqual(stopped);
    expect(car.position.wx).toBeLessThan(130);
    await session.command({ kind: "teleport", position: { wx: 608, wy: 192 } });
    for (let i = 0; i < 60; i++) await session.step(input, 1 / 60, range);
    expect(car.position.wx).toBeGreaterThan(stopped.wx + 10);
  } finally {
    await session.close();
  }
}, 30000);

it("enforces the global cap even when three independent aisles are clear", async () => {
  const recipe = parkingRecipe();
  recipe.props = [];
  recipe.parkedVehicles = [];
  recipe.roads = [];
  recipe.player.position = { wx: 700, wy: 700 };
  recipe.parking = {
    id: "three-clear-aisles",
    bounds: { left: 0, top: 0, right: 1024, bottom: 1024 },
    visits: [0, 1, 2].map((i) => ({
      id: `visit-${i}`,
      bayId: `bay-${i}`,
      aisle: `aisle-${i}`,
      model: "compact-1",
      delay: 0,
      shopSeconds: 8,
      arrival: [
        { wx: 100, wy: 100 + i * 160 },
        { wx: 400, wy: 100 + i * 160 },
      ],
      departure: [
        { wx: 400, wy: 100 + i * 160 },
        { wx: 600, wy: 100 + i * 160 },
      ],
      walk: [
        { wx: 400, wy: 124 + i * 160 },
        { wx: 500, wy: 124 + i * 160 },
      ],
    })),
  };
  const session = await ScenarioSession.create(recipe);
  try {
    await session.step(input, 1 / 60, range);
    const parking = required(session.realm.parking);
    expect(parking.states.map((s) => s.phase)).toEqual(["arriving", "arriving", "waiting"]);
    expect(parking.maneuvers).toBe(2);
  } finally {
    await session.close();
  }
});

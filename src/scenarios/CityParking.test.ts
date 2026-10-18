import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { cityParkingRecipe } from "./CityParkingRecipe.js";
import { ScenarioSession } from "./ScenarioSession.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
it("drives a native road car into a generated center and back, preserving identity and all saved phases", async () => {
  const session = await ScenarioSession.create(cityParkingRecipe());
  try {
    let traffic = required(session.realm.traffic);
    let car = required(traffic.states.get(required(session.handles.car)));
    const identity = car.entity.proceduralId;
    const persistentId = car.entity.persistentId;
    const center = required(
      traffic.strategy.shoppingCenters?.(car.entity.position.wx, car.entity.position.wy)[0],
    );
    const range = {
      minCx: Math.floor(center.wx / 256),
      maxCx: Math.floor((center.wx + 1279) / 256),
      minCy: Math.floor(center.wy / 256),
      maxCy: Math.floor((center.roadY + 255) / 256),
    };
    await session.realm.ensureReady(range);
    const phases = new Set<string>();
    let started = false,
      finished = false;
    for (let i = 0; i < 14500; i++) {
      const before = { ...car.entity.position };
      await session.step(idle, 1 / 60, range);
      expect(
        Math.hypot(car.entity.position.wx - before.wx, car.entity.position.wy - before.wy),
      ).toBeLessThan(1.1);
      const trip = car.shopping;
      if (trip) {
        started = true;
        expect(session.realm.vehicles.available(car.entity.id)).toBe(false);
        expect(trip.maneuvers).toBeLessThanOrEqual(1);
        const state = required(trip.states[0]);
        if (!phases.has(state.phase)) {
          phases.add(state.phase);
          expect([...traffic.states.values()].filter((s) => s.placed)).toHaveLength(18);
          const saved = trip.snapshot();
          const pose = structuredClone(car.entity.position);
          await session.reload();
          traffic = required(session.realm.traffic);
          car = required(
            [...traffic.states.values()].find((s) => s.entity.proceduralId === identity),
          );
          expect(car.entity.position).toEqual(pose);
          expect(car.entity.persistentId).toBe(persistentId);
          const actual = required(car.shopping).snapshot();
          expect(
            actual.visits.map((s) => ({
              phase: s.phase,
              index: s.index,
              remaining: s.remaining,
              shopper: s.shopper?.position,
            })),
          ).toEqual(
            saved.visits.map((s) => ({
              phase: s.phase,
              index: s.index,
              remaining: s.remaining,
              shopper: s.shopper?.position,
            })),
          );
          expect(
            session.realm.entityManager.entities.filter((e) => e.proceduralId === identity),
          ).toHaveLength(1);
          expect(
            session.realm.entityManager.entities.filter((e) => e.tags?.has("parking-visit")),
          ).toHaveLength(Number(!!state.shopper));
        }
      } else if (started) {
        expect(car.parked).toBe(false);
        const mergeStart = required(car.resumePath?.points[0]);
        expect(
          Math.hypot(mergeStart.x - car.entity.position.wx, mergeStart.y - car.entity.position.wy),
        ).toBeLessThan(0.1);
        expect(car.entity.proceduralId).toBe(identity);
        expect(car.entity.persistentId).toBe(persistentId);
        const merge = { ...car.entity.position };
        for (let j = 0; j < 120; j++) await session.step(idle, 1 / 60, range);
        expect(car.entity.position.wx).toBeLessThan(merge.wx - 15);
        expect(car.shoppingTrips).toBe(1);
        finished = true;
        break;
      }
    }
    expect(
      finished,
      JSON.stringify({
        ...traffic.shoppingDiagnostics,
        position: car.entity.position,
        state: car.shopping?.states[0],
        nearProps: session.realm.propManager.props
          .filter(
            (p) =>
              Math.hypot(
                p.position.wx - car.entity.position.wx,
                p.position.wy - car.entity.position.wy,
              ) < 150,
          )
          .map((p) => ({ type: p.type, position: p.position, collider: p.collider })),
      }),
    ).toBe(true);
    expect([...phases].sort()).toEqual(
      [
        "arriving",
        "parked",
        "walking-to-shop",
        "shopping",
        "returning",
        "ready-to-leave",
        "leaving",
      ].sort(),
    );
  } finally {
    await session.close();
  }
}, 60000);

it("populates native parked cars once, retains edits and does not pin a city after leaving", async () => {
  const recipe = cityParkingRecipe();
  delete recipe.traffic;
  delete recipe.parkedVehicles;
  const session = await ScenarioSession.create(recipe);
  try {
    const p = recipe.player.position;
    let traffic = required(session.realm.traffic);
    const center = required(traffic.strategy.shoppingCenters?.(p.wx, p.wy)[0]);
    const range = {
      minCx: Math.floor(center.wx / 256),
      maxCx: Math.floor((center.wx + 1279) / 256),
      minCy: Math.floor(center.wy / 256),
      maxCy: Math.floor((center.roadY + 255) / 256),
    };
    for (let i = 0; i < 125; i++) await session.step(idle, 1 / 60, range);
    const parked = [...traffic.states.values()].filter((s) => s.placed);
    expect(parked).toHaveLength(18);
    expect(new Set(parked.map((s) => s.entity.proceduralId)).size).toBe(18);
    const removed = required(parked[0]);
    const identity = removed.entity.proceduralId;
    session.realm.entityManager.remove(removed.entity.id, true);
    await session.reload();
    traffic = required(session.realm.traffic);
    for (let i = 0; i < 125; i++) await session.step(idle, 1 / 60, range);
    expect([...traffic.states.values()].filter((s) => s.placed)).toHaveLength(17);
    expect([...traffic.states.values()].some((s) => s.entity.proceduralId === identity)).toBe(
      false,
    );
    expect(traffic.shoppingRanges().length).toBeGreaterThan(0);
    traffic.visibleRanges = [{ minCx: -100, maxCx: -99, minCy: -100, maxCy: -99 }];
    expect(traffic.shoppingRanges()).toEqual([]);
  } finally {
    await session.close();
  }
}, 30000);
